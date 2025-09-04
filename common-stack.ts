import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as naming from "../../bin/naming";
import * as data from "../../bin/data";

export class CommonStack extends cdk.Stack {

    private readonly vpc: ec2.IVpc
    private readonly vpcEndpointSg: ec2.SecurityGroup

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        this.vpc = this.retrieveVpc()
        this.vpcEndpointSg = this.createVpcEndpointsSecurityGroup()
        this.createVpcEndpoints()
        this.createNetworkAcl()
    }

    private retrieveVpc(): ec2.IVpc {
        return ec2.Vpc.fromLookup(this, "Vpc", {vpcId: data.vpcId})
    }

    private createVpcEndpointsSecurityGroup(): ec2.SecurityGroup {
        const sg = new ec2.SecurityGroup(this, "VpcEndpointSecurityGroup", {
            vpc: this.vpc,
            allowAllOutbound: true,
            securityGroupName: naming.sg.endpoints,
            description: "Security group for the Vpc Endpoints",
        })

        cdk.Tags.of(sg).add('Name', naming.sg.endpoints)

        sg.addIngressRule(
            ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
            ec2.Port.allTraffic(),
            'Allow all traffic from VPC'
        )

        return sg
    }

    private createVpcEndpoints(): void {
        this.createSsmVpcEndpoints()
        this.createS3VpcEndpoint()
        this.createSecretManagerEndpoint()
        this.createEcrEndpoint()
        this.createCloudWatchLogsEndpoint()
    }

    /**
     * @internal
     */
    private createSsmVpcEndpoints(): void {
        this.vpc.addInterfaceEndpoint('VpcEndpointSSM', {
            service: ec2.InterfaceVpcEndpointAwsService.SSM,
            privateDnsEnabled: true,
            open: false,
            securityGroups: [this.vpcEndpointSg],
            subnets: {subnets: this.vpc.privateSubnets},
        })

        this.vpc.addInterfaceEndpoint('VpcEndpointSSMMessages', {
            service: ec2.InterfaceVpcEndpointAwsService.SSM_MESSAGES,
            privateDnsEnabled: true,
            open: false,
            securityGroups: [this.vpcEndpointSg],
            subnets: {subnets: this.vpc.privateSubnets},
        })

        this.vpc.addInterfaceEndpoint('VpcEndpointEC2Messages', {
            service: ec2.InterfaceVpcEndpointAwsService.EC2_MESSAGES,
            privateDnsEnabled: true,
            open: false,
            securityGroups: [this.vpcEndpointSg],
            subnets: {subnets: this.vpc.privateSubnets},
        })
    }

    /**
     * @internal
     */
    private createS3VpcEndpoint(): void {
        this.vpc.addGatewayEndpoint('VpcEndpointS3', {
            service: ec2.GatewayVpcEndpointAwsService.S3,
            subnets: [
                {subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS},
                {subnetType: ec2.SubnetType.PUBLIC},
                {subnetType: ec2.SubnetType.PRIVATE_ISOLATED}
            ]
        })
    }

    private createSecretManagerEndpoint(): void {
        this.vpc.addInterfaceEndpoint('VpcEndpointSecretManager', {
            service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
            privateDnsEnabled: true,
            open: false,
            securityGroups: [this.vpcEndpointSg],
            subnets: {subnets: this.vpc.privateSubnets},
        })
    }

    private createEcrEndpoint(): void {
        this.vpc.addInterfaceEndpoint('VpcEndpointEcr', {
            service: ec2.InterfaceVpcEndpointAwsService.ECR,
            privateDnsEnabled: true,
            open: false,
            securityGroups: [this.vpcEndpointSg],
            subnets: {subnets: this.vpc.privateSubnets},
        })

        this.vpc.addInterfaceEndpoint('VpcEndpointEcrDocker', {
            service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
            privateDnsEnabled: true,
            open: false,
            securityGroups: [this.vpcEndpointSg],
            subnets: {subnets: this.vpc.privateSubnets},
        })
    }

    private createCloudWatchLogsEndpoint(): void {
        this.vpc.addInterfaceEndpoint('VpcEndpointCloudWatchLogs', {
            service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
            privateDnsEnabled: true,
            open: false,
            securityGroups: [this.vpcEndpointSg],
            subnets: {subnets: this.vpc.privateSubnets},
        })
    }

    private createNetworkAcl(): void {
        const networkAcl = new ec2.NetworkAcl(this, "NetworkAcl", {
            vpc: this.vpc,
            networkAclName: naming.network.networkAcl,
            subnetSelection: {
                subnets: [
                    ...this.vpc.privateSubnets,
                    ...this.vpc.isolatedSubnets,
                    ...this.vpc.publicSubnets,
                ]
            }
        })

        networkAcl.addEntry('All traffic from VPC', {
            cidr: ec2.AclCidr.ipv4(this.vpc.vpcCidrBlock),
            ruleNumber: 100,
            ruleAction: ec2.Action.ALLOW,
            traffic: ec2.AclTraffic.allTraffic(),
            direction: ec2.TrafficDirection.INGRESS,
        })

        networkAcl.addEntry('MySQL for Shared VPC', {
            cidr: ec2.AclCidr.ipv4(data.sharedVpcCidr),
            ruleNumber: 110,
            ruleAction: ec2.Action.ALLOW,
            traffic: ec2.AclTraffic.tcpPort(3306),
            direction: ec2.TrafficDirection.INGRESS,
        })

        networkAcl.addEntry('FTP traffic + SSH', {
            cidr: ec2.AclCidr.anyIpv4(),
            ruleNumber: 130,
            ruleAction: ec2.Action.DENY,
            traffic: ec2.AclTraffic.tcpPortRange(20, 22),
            direction: ec2.TrafficDirection.INGRESS,
        })

        networkAcl.addEntry('MySQL', {
            cidr: ec2.AclCidr.anyIpv4(),
            ruleNumber: 140,
            ruleAction: ec2.Action.DENY,
            traffic: ec2.AclTraffic.tcpPort(3306),
            direction: ec2.TrafficDirection.INGRESS,
        })

        networkAcl.addEntry('RDP', {
            cidr: ec2.AclCidr.anyIpv4(),
            ruleNumber: 150,
            ruleAction: ec2.Action.DENY,
            traffic: ec2.AclTraffic.tcpPort(3389),
            direction: ec2.TrafficDirection.INGRESS,
        })

        networkAcl.addEntry('PostgresSQL', {
            cidr: ec2.AclCidr.anyIpv4(),
            ruleNumber: 160,
            ruleAction: ec2.Action.DENY,
            traffic: ec2.AclTraffic.tcpPort(5432),
            direction: ec2.TrafficDirection.INGRESS,
        })

        networkAcl.addEntry('QOTD', {
            cidr: ec2.AclCidr.anyIpv4(),
            ruleNumber: 170,
            ruleAction: ec2.Action.DENY,
            traffic: ec2.AclTraffic.udpPort(17),
            direction: ec2.TrafficDirection.INGRESS,
        })

        networkAcl.addEntry('All traffic - INGRESS', {
            cidr: ec2.AclCidr.anyIpv4(),
            ruleNumber: 9999,
            ruleAction: ec2.Action.ALLOW,
            traffic: ec2.AclTraffic.allTraffic(),
            direction: ec2.TrafficDirection.INGRESS,
        })

        networkAcl.addEntry('All traffic - EGRESS', {
            cidr: ec2.AclCidr.anyIpv4(),
            ruleNumber: 100,
            ruleAction: ec2.Action.ALLOW,
            traffic: ec2.AclTraffic.allTraffic(),
            direction: ec2.TrafficDirection.EGRESS,
        })

    }
}