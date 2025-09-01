import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as data from "../../bin/data";
import * as naming from "../../bin/naming";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as sm from "aws-cdk-lib/aws-secretsmanager";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { IamRoles } from "../utils/iam-roles";

export class DatabaseStack extends cdk.Stack {

    private readonly vpc: ec2.IVpc

    private readonly subnetGroup: rds.SubnetGroup
    private readonly engine: rds.IClusterEngine
    private readonly parameterGroup: rds.ParameterGroup
    private readonly securityGroup: ec2.SecurityGroup
    private readonly auroraCluster: rds.DatabaseCluster

    constructor(scope: Construct, id: string, props: cdk.StackProps) {
        super(scope, id, props);

        this.vpc = this.retrieveVpc()

        /**
         * Database
         */
        this.subnetGroup = this.createSubnetGroup()
        this.engine = this.createEngine()

        this.parameterGroup = this.createParameterGroup()
        this.securityGroup = this.createSecurityGroup()

        this.auroraCluster = this.createAuroraCluster()
        this.createSecretForAppAndAttachToAuroraCluster()
    }

    private retrieveVpc(): ec2.IVpc {
        return ec2.Vpc.fromLookup(this, "Vpc", {vpcId: data.vpcId})
    }

    private createSubnetGroup(): rds.SubnetGroup {
        return new rds.SubnetGroup(this, "DatabaseSubnetGroup", {
            vpc: this.vpc,
            subnetGroupName: naming.database.subnetGroup,
            description: "Isolated subnet group for databases",
            vpcSubnets: {subnetType: ec2.SubnetType.PRIVATE_ISOLATED,}
        })
    }

    private createEngine(): rds.IClusterEngine {
        const version: rds.AuroraMysqlEngineVersion = rds.AuroraMysqlEngineVersion.of('8.0.mysql_aurora.3.08.1', '8.0')
        return rds.DatabaseClusterEngine.auroraMysql({version})
    }

    private createParameterGroup(): rds.ParameterGroup {
        return new rds.ParameterGroup(this, "DatabaseParameterGroup", {
            engine: this.engine,
            name: naming.database.parameterGroup,
            description: `Parameter group for ${data.project} database cluster`,
            parameters: {
                'general_log': '1',
                'slow_query_log': '1',
                'server_audit_logging': '1',
                'server_audit_events': 'CONNECT,QUERY,QUERY_DDL,QUERY_DCL',
            },
        })
    }

    private createSecurityGroup(): ec2.SecurityGroup {

        const securityGroup: ec2.SecurityGroup = new ec2.SecurityGroup(this, "DatabaseSecurityGroup", {
            vpc: this.vpc,
            securityGroupName: naming.database.securityGroup,
            allowAllOutbound: true,
            description: "Security group for the database cluster"
        })

        cdk.Tags.of(securityGroup).add('Name', naming.database.securityGroup)

        new ssm.StringParameter(this, "DatabaseSecurityGroupId", {
            parameterName: `/cdk/output/${data.project}/${data.env}/database-app-sg-id`,
            stringValue: securityGroup.securityGroupId,
        })

        securityGroup.addIngressRule(
            ec2.Peer.ipv4(data.sharedVpcCidr),
            ec2.Port.MYSQL_AURORA,
            "Allow traffic from the shared VPC to the database"
        )

        return securityGroup
    }

    private createAuroraCluster(): rds.DatabaseCluster {

        const secretCredentials: sm.Secret = new sm.Secret(this, "DatabaseSecretCredentials", {
            secretName: naming.database.rootSecret,
            generateSecretString: {
                excludePunctuation: true,
                secretStringTemplate: JSON.stringify({username: "admin"}),
                generateStringKey: "password",
            }
        })

        const backUpRetention: cdk.Duration = data.env === "pro" ? cdk.Duration.days(30) : cdk.Duration.days(7)

        return new rds.DatabaseCluster(this, "DatabaseAuroraCluster", {
            engine: this.engine,
            vpc: this.vpc,
            clusterIdentifier: naming.database.cluster,
            copyTagsToSnapshot: true,
            credentials: rds.Credentials.fromSecret(secretCredentials),
            subnetGroup: this.subnetGroup,
            parameterGroup: this.parameterGroup,
            securityGroups: [this.securityGroup],
            storageEncrypted: true,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            cloudwatchLogsExports: ["audit", "error", "general", "slowquery"],
            defaultDatabaseName: naming.database.defaultDatabaseName,
            enablePerformanceInsights: true,
            performanceInsightRetention: rds.PerformanceInsightRetention.DEFAULT,
            monitoringRole: IamRoles.generateRdsMonitoringRole(this, naming.database.monitoringRole),
            monitoringInterval: cdk.Duration.seconds(60),
            writer: rds.ClusterInstance.provisioned("DatabaseInstanceWriter", {
                instanceType: new ec2.InstanceType(data.databaseInstanceType),
                instanceIdentifier: naming.database.writer,
                publiclyAccessible: false,
                allowMajorVersionUpgrade: false,
                autoMinorVersionUpgrade: true,
                enablePerformanceInsights: true,
            }),
            backup: {
                retention: backUpRetention,
                preferredWindow: "00:00-03:00"
            }
        })
    }

    private createSecretForAppAndAttachToAuroraCluster(): void {

        const secretUserApp: sm.Secret = new sm.Secret(this, "DatabaseSecretUserApp", {
            secretName: naming.database.appSecret,
            generateSecretString: {
                excludePunctuation: true,
                secretStringTemplate: JSON.stringify({
                    username: "eval_app",
                    hostReader: this.auroraCluster.clusterEndpoint.hostname,
                }),
                generateStringKey: "password",
            }
        })

        new sm.SecretTargetAttachment(this, "DatabaseSecretUserAppAttachment", {
            secret: secretUserApp,
            target: this.auroraCluster,
        })

        new ssm.StringParameter(this, "DatabaseSecretUserAppArn", {
            parameterName: `/cdk/output/${data.project}/${data.env}/database-secret-user-app-arn`,
            stringValue: secretUserApp.secretArn,
        })
    }
}