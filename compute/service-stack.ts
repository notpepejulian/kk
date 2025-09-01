import * as cdk from "aws-cdk-lib";
import { Construct } from 'constructs';
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elb from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as sm from "aws-cdk-lib/aws-secretsmanager";
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as naming from "../../bin/naming";
import * as data from "../../bin/data";
import { Certificates } from "../utils/certificates";
import { WordpressService } from "./wordpress";
import { IamRoles } from "../utils/iam-roles";
import { EfsStack } from "../storage/efs";

export class ComputeStack extends cdk.Stack {

    private readonly vpc: ec2.IVpc;
    private readonly databaseSg: ec2.ISecurityGroup;
    private readonly databaseSecret: sm.ISecret;
    private readonly executionRole: iam.Role;
    private readonly cluster: ecs.Cluster;
    private readonly sgAlb: ec2.SecurityGroup;
    public readonly alb: elb.ApplicationLoadBalancer;
    private readonly efsStack: EfsStack;

    constructor(scope: Construct, id: string, props: cdk.StackProps) {
        super(scope, id, props);

        //VPC
        this.vpc = this.retrieveVpc();

        //this.efsStack = new EfsStack(this, 'EfsStack', {
        //    env: props.env,
        //});

        //RDS
        this.databaseSg = this.retrieveDatabaseSg();
        this.databaseSecret = this.retrieveDatabaseSecret();
        
        //EC2
        this.sgAlb = this.createSgForAlb();
        this.alb = this.createApplicationLoadBalancer();

        //IAM
        this.executionRole = this.createExecutionRole();

        //ECS
        this.cluster = this.createEcsCluster();
        this.createServices();
    }

    //** VPC **/
    private retrieveVpc(): ec2.IVpc {
        return ec2.Vpc.fromLookup(this, "Vpc", { vpcId: data.vpcId });
    }

    //** RDS **/
    private retrieveDatabaseSg(): ec2.ISecurityGroup {
        const path = `/cdk/output/${data.project}/${data.env}/database-app-sg-id`;
        const databaseSgId: string = ssm.StringParameter.valueForStringParameter(this, path);
        return ec2.SecurityGroup.fromSecurityGroupId(this, "DatabaseSg", databaseSgId);
    }

    private retrieveDatabaseSecret(): sm.ISecret {
        const path = `/cdk/output/${data.project}/${data.env}/database-secret-user-app-arn`;
        const databaseSecretArn: string = ssm.StringParameter.valueForStringParameter(this, path);
        return sm.Secret.fromSecretCompleteArn(this, "DatabaseSecretUserApp", databaseSecretArn);
    }

    //** EC2 **/
    private createSgForAlb(): ec2.SecurityGroup {
        const albSg = new ec2.SecurityGroup(this, "AlbSecurityGroup", {
            vpc: this.vpc,
            allowAllOutbound: true,
            securityGroupName: naming.sg.alb,
            description: "Security group for the Application Load Balancer",
        });

        cdk.Tags.of(albSg).add('Name', naming.sg.alb);

        albSg.addIngressRule(
            ec2.Peer.prefixList('pl-4fa04526'),
            ec2.Port.HTTPS,
            'Allow traffic from CloudFront'
        );

        return albSg;
    }

    private createApplicationLoadBalancer(): elb.ApplicationLoadBalancer {
        const certificates: acm.ICertificate[] = Certificates.retrieveFromArn(this, data.albCertificateArns);

        const alb = new elb.ApplicationLoadBalancer(this, "ApplicationLoadBalancer", {
            vpc: this.vpc,
            vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
            internetFacing: true,
            securityGroup: this.sgAlb,
            loadBalancerName: naming.elb.alb,
            desyncMitigationMode: elb.DesyncMitigationMode.STRICTEST,
            dropInvalidHeaderFields: true,
        });

        alb.addListener("HttpsListener", {
            open: false,
            protocol: elb.ApplicationProtocol.HTTPS,
            // port: parseInt(ec2.Port.HTTPS.toString(),
            port: 443,
            certificates: certificates,
            sslPolicy: elb.SslPolicy.TLS13_RES,
            defaultAction: elb.ListenerAction.fixedResponse(503, {
                contentType: "text/plain",
                messageBody: "Service Unavailable",
            })
        });

        return alb;
    }

    //** ECS **/
    private createEcsCluster(): ecs.Cluster {
        return new ecs.Cluster(this, "EcsCluster", {
            vpc: this.vpc,
            clusterName: naming.ecs.cluster,
            containerInsightsV2: ecs.ContainerInsights.ENABLED,
        });
    }

    private createServices(): void {
        const sharedSecretVariables: Record<string, ecs.Secret> = {
            DATABASE_USERNAME: ecs.Secret.fromSecretsManager(this.databaseSecret, 'username'),
            DATABASE_PASSWORD: ecs.Secret.fromSecretsManager(this.databaseSecret, 'password'),
            DATABASE_HOST: ecs.Secret.fromSecretsManager(this.databaseSecret, 'host'),
            DATABASE_PORT: ecs.Secret.fromSecretsManager(this.databaseSecret, 'port'),
            DATABASE_NAME: ecs.Secret.fromSecretsManager(this.databaseSecret, 'dbname'),
        };

        new WordpressService(this, {
            vpc: this.vpc,
            alb: this.alb,
            sgAlb: this.sgAlb,
            sgDatabase: this.databaseSg,
            cluster: this.cluster,
            executionRole: this.executionRole,
            efsFileSystem: this.efsStack.fileSystem,
            efsAccessPoint: this.efsStack.accessPoint,
            variables: {
                fromPlain: {}, // Vacío porque estamos usando fromSecret para las credenciales
                fromSecret: sharedSecretVariables,
            }
        });
    }

    //** IAM **/
    private createExecutionRole(): iam.Role {
        return new iam.Role(this, `TaskExecutionRole`, {
            roleName: naming.ecs.executionRole,
            assumedBy: new iam.CompositePrincipal(
                new iam.ServicePrincipal('ecs.amazonaws.com'),
                new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
            ),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
            ],
            inlinePolicies: {
                'allow-ssm': new iam.PolicyDocument({
                    statements: [
                        new iam.PolicyStatement({
                            actions: [
                                'ssmmessages:*',
                                'ssm:UpdateInstanceInformation',
                                'ecs:ExecuteCommand',
                            ],
                            resources: ['*'],
                        })
                    ]
                }),
                'vpc-perimeter': IamRoles.generateVpcPerimeterPolicyForRole(this.vpc.vpcId)
            }
        });
    }
}