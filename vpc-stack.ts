import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { VpcModule } from "@sanoma-cloud/vpc";
import * as data from "../../bin/data";
import * as params from "../utils/param";
import * as name from "../../bin/naming";

export class VpcStack extends cdk.Stack {

    private readonly vpc: ec2.CfnVPC

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        this.vpc = this.createVpc()
        params.createParam(this, "VpcId", name.network.vpc, this.vpc.attrVpcId)
        new cdk.CfnOutput(this, 'VpcIdOutput', {
            value: this.vpc.attrVpcId,
            exportName: 'VpcIdMujeresProtagonistas',
        });
    }

    private createVpc(): ec2.CfnVPC {
        const vpcModule = new VpcModule(this, "Vpc", {
            region: this.region,
            project: data.project,
            env: data.env,
            vpcCidr: data.vpc[data.env].vpcCidr,
            publicSubnets: data.vpc[data.env].subnetsPublicCidr,
            privateSubnets: data.vpc[data.env].subnetsPrivateCidr,
            isolatedSubnets: data.vpc[data.env].subnetsIsolatedCidr,
        })

        return vpcModule.cfnVpc
    }
}