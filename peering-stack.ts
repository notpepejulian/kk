import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as naming from "../../bin/naming";
import * as data from "../../bin/data";

export class PeeringStack extends cdk.Stack {

  private readonly vpc: ec2.IVpc

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    this.vpc = this.retrieveVpc();
    this.createPeeringConnection();
  }

  private retrieveVpc(): ec2.IVpc {
    return ec2.Vpc.fromLookup(this, "Vpc", {vpcId: data.vpcId})
  }

  private createPeeringConnection(): void {
    const peeringConnection = new ec2.CfnVPCPeeringConnection(this, "PeeringConnection", {
        vpcId: this.vpc.vpcId,
        peerOwnerId: data.peering.accountId,
        peerVpcId: data.peering.vpcId,
        peerRoleArn: data.peering.roleArn,
        peerRegion: 'eu-west-1',
        tags: [{key: "Name", value: naming.network.peering,}]
    })

    this.vpc.isolatedSubnets.forEach(({routeTable, subnetId}: ec2.ISubnet) => {
        data.peering.privateSubnetsCidr.forEach((cidr: string, index: number) => {
            new ec2.CfnRoute(this, `${subnetId}-${index}-RouteToPeeringConnection`, {
                routeTableId: routeTable.routeTableId,
                destinationCidrBlock: cidr,
                vpcPeeringConnectionId: peeringConnection.ref,
            })
        })
    })
}
}