import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from "constructs";

export class IamRoles {

    static generateRdsMonitoringRole(
        scope: Construct,
        roleName: string
    ): iam.Role {
        return new iam.Role(scope, "RdsMonitoringRole", {
            roleName: roleName,
            assumedBy: new iam.ServicePrincipal("monitoring.rds.amazonaws.com"),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AmazonRDSEnhancedMonitoringRole")
            ]
        })
    }

    static generateVpcPerimeterPolicyForRole(vpcId: string): iam.PolicyDocument {
        return new iam.PolicyDocument({
            statements: [
                new iam.PolicyStatement({
                    effect: iam.Effect.DENY,
                    actions: ['*'],
                    resources: ['*'],
                    conditions: {
                        StringNotEqualsIfExists: {
                            'aws:SourceVpc': vpcId,
                        },
                        BoolIfExists: {
                            'aws:ViaAWSService': 'false',
                        }
                    }
                })
            ]
        })
    }
}