import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as logs from "aws-cdk-lib/aws-logs";
import * as data from "../../bin/data";
import * as naming from "../../bin/naming";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as elb from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as sm from "aws-cdk-lib/aws-secretsmanager";
import * as params from "../utils/param";
import * as efs from "aws-cdk-lib/aws-efs";
import { SecretManagerUtils } from "../utils/secret-manager-utils";
import { APP_CUSTOM_HEADER_NAME } from "../cloudfront/cloudfront-stack";

interface WordpressServiceProps {
    vpc: ec2.IVpc
    alb: elb.IApplicationLoadBalancer,
    sgAlb: ec2.ISecurityGroup,
    sgDatabase: ec2.ISecurityGroup,
    cluster: ecs.ICluster,
    executionRole: iam.IRole,
    efsFileSystem: efs.IFileSystem, 
    efsAccessPoint: efs.IAccessPoint,
    variables: {
        fromPlain: Record<string, string>,
        fromSecret: Record<string, ecs.Secret>,
    }
}

const APP_PORT = 80;
const SERVICE_NAME = 'wordpress';

export class WordpressService {

    private readonly scope: Construct;
    private readonly props: WordpressServiceProps;

    private readonly logGroup: logs.LogGroup;
    private readonly repository: ecr.Repository;
    private readonly secret: sm.ISecret | undefined;
    private readonly taskRole: iam.Role;
    private readonly taskDefinition: ecs.FargateTaskDefinition;
    private readonly securityGroup: ec2.SecurityGroup;
    private readonly targetGroup: elb.ApplicationTargetGroup;
    private readonly service: ecs.FargateService;

    constructor(scope: Construct, props: WordpressServiceProps) {
        this.scope = scope;
        this.props = props;

        this.logGroup = this.createLogGroup();
        // this.repository = this.retrieveEcrRepository();
        this.repository = this.createEcrRepository();
        this.taskRole = this.createTaskRole();
        this.secret = this.createSecretVariablesFromPlain();
        params.createParam(this.scope, "TaskDefArn", naming.ecs.tasks.wordpress.taskRole, this.taskRole.roleArn);
        this.taskDefinition = this.createTaskDefinition();
        this.securityGroup = this.createSecurityGroup();
        params.createParam(this.scope, "WordpresServiceSgId", naming.sg.tasks.wordpress, this.securityGroup.securityGroupId);
        this.targetGroup = this.createTargetGroup();
        this.service = this.createService();
        this.configureEfsAccess();
        this.attachActionToListener();
    }

    private createLogGroup(): logs.LogGroup {
        const retention = data.env != 'pro' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.TWO_YEARS;

        return new logs.LogGroup(this.scope, `LogGroupWordpress`, {
            logGroupName: naming.ecs.tasks.wordpress.logging,
            retention: retention,
            removalPolicy: cdk.RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE,
        });
    }

    // private retrieveEcrRepository(): ecr.IRepository {
    //     return ecr.Repository.fromRepositoryName(
    //         this.scope, 
    //         'WordpressRepository', 
    //         naming.ecs.tasks.wordpress.repository
    //     );
    // }

    private createEcrRepository(): ecr.Repository{
        return new ecr.Repository(this.scope, 'WordpressRepository', {
            repositoryName: naming.ecs.tasks.wordpress.repository,
            
        });

    }

    private createTaskRole(): iam.Role {
        return new iam.Role(this.scope, 'WordpressTaskRole', {
            roleName: naming.ecs.tasks.wordpress.taskRole,
            assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
            ],
        });
    }

    private createSecretVariablesFromPlain(): sm.ISecret | undefined {
        if (Object.keys(this.props.variables.fromPlain).length === 0) {
            return undefined;
        }
        return SecretManagerUtils.createSecretFromPlainVariables(this.scope, 'WordpressSecret', {
            name: naming.ecs.tasks.wordpress.secret,
            variables: this.props.variables.fromPlain,
        });
    }

    private createTaskDefinition(): ecs.FargateTaskDefinition {
        const taskDefinition = new ecs.FargateTaskDefinition(this.scope, 'WordpressTaskDefinition', {
            family: naming.ecs.tasks.wordpress.taskDefinition,
            executionRole: this.props.executionRole,
            taskRole: this.taskRole,
            cpu: 0.5,
            memoryLimitMiB: 1024,
        });

        // Añadir volumen EFS
        taskDefinition.addVolume({
            name: 'wordpressEfsVolume',
            efsVolumeConfiguration: {
                fileSystemId: this.props.efsFileSystem.fileSystemId,
                authorizationConfig: {
                    accessPointId: this.props.efsAccessPoint.accessPointId,
                    iam: 'ENABLED',
                },
                transitEncryption: 'ENABLED',
            },
        });

        const container = taskDefinition.addContainer('WordpressContainer', {
            containerName: SERVICE_NAME,
            essential: true,
            image: ecs.ContainerImage.fromEcrRepository(this.repository, data.services.wordpress.imageTag),
            healthCheck: {
                command: ["CMD-SHELL", `curl -s -f http://127.0.0.1/ || exit 1`],
                interval: cdk.Duration.seconds(30),
                startPeriod: cdk.Duration.seconds(60),
                timeout: cdk.Duration.seconds(10),
                retries: 2,
            },
            logging: ecs.LogDrivers.awsLogs({
                logGroup: this.logGroup,
                streamPrefix: SERVICE_NAME,
            }),
            portMappings: [{ containerPort: APP_PORT }],
            secrets: this.props.variables.fromSecret, // Usamos directamente fromSecret
        });

        // Añadir mount point
        container.addMountPoints({
            containerPath: '/var/www/html',
            sourceVolume: 'wordpressEfsVolume',
            readOnly: false,
        });

        return taskDefinition;
    }

    private createSecurityGroup(): ec2.SecurityGroup {
        const sg = new ec2.SecurityGroup(this.scope, `WordpressServiceSg`, {
            vpc: this.props.vpc,
            securityGroupName: naming.sg.tasks.wordpress,
            allowAllOutbound: true,
            description: `Security group for the ECS service (${SERVICE_NAME})`,
        });

        cdk.Tags.of(sg).add('Name', naming.sg.tasks.wordpress);

        sg.addIngressRule(this.props.sgAlb, ec2.Port.tcp(APP_PORT), "Allow traffic from the ALB");
        this.props.sgDatabase.addIngressRule(sg, ec2.Port.tcp(3306), `Allow traffic from the application (${SERVICE_NAME}) to the database`);

        return sg;
    }

    private createTargetGroup(): elb.ApplicationTargetGroup {
        return new elb.ApplicationTargetGroup(this.scope, `WordpressServiceTargetGroup`, {
            vpc: this.props.vpc,
            targetGroupName: naming.elb.tg,
            protocol: elb.ApplicationProtocol.HTTP,
            targetType: elb.TargetType.IP,
            stickinessCookieDuration: cdk.Duration.days(1),
            port: APP_PORT,
            healthCheck: {
                path: '/',
                interval: cdk.Duration.seconds(60),
                timeout: cdk.Duration.seconds(30),
                healthyThresholdCount: 3,
                unhealthyThresholdCount: 5,
                healthyHttpCodes: '200',
            },
        });
    }

    private createService(): ecs.FargateService {
        const service = new ecs.FargateService(this.scope, `WordpressService`, {
            cluster: this.props.cluster,
            serviceName: naming.ecs.tasks.wordpress.service,
            desiredCount: 2,
            taskDefinition: this.taskDefinition,
            assignPublicIp: false,
            enableExecuteCommand: true,
            securityGroups: [this.securityGroup],
            circuitBreaker: { rollback: true },
            vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        });

        service.attachToApplicationTargetGroup(this.targetGroup);

        const asg = service.autoScaleTaskCount({
            minCapacity: 2,
            maxCapacity: 5,
        });

        asg.scaleOnCpuUtilization('CpuScaling', {
            targetUtilizationPercent: 75,
        });

        return service;
    }

    private configureEfsAccess(): void {
        this.props.efsFileSystem.connections.allowDefaultPortFrom(this.securityGroup);
        
        // Política IAM para acceso a EFS
        this.taskRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'elasticfilesystem:ClientMount',
                'elasticfilesystem:ClientWrite',
                'elasticfilesystem:ClientRootAccess'
            ],
            resources: [this.props.efsFileSystem.fileSystemArn],
            conditions: {
                StringEquals: {
                    'elasticfilesystem:AccessPointArn': this.props.efsAccessPoint.accessPointArn
                }
            }
        }));
    }

    private attachActionToListener(): void {
        if (this.props.alb.listeners.length > 0) {
            this.props.alb.listeners[0].addAction(`WordpressServiceAction`, {
                priority: 1,
                conditions: [
                    elb.ListenerCondition.httpHeader(APP_CUSTOM_HEADER_NAME, [data.cloudfrontCustomHeaderValue]),
                    elb.ListenerCondition.hostHeaders(data.cloudfrontDomains[data.env].filter(domain => domain.endsWith('.es'))),
                ],
                action: elb.ListenerAction.forward([this.targetGroup]),
            });
        }
    }

    public getService(): ecs.FargateService {
        return this.service;
    }
}