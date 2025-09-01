import * as sm from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as ecs from "aws-cdk-lib/aws-ecs";

export class SecretManagerUtils {
    static createSecretFromPlainVariables(
        scope: Construct,
        logicalId: string,
        props: { name: string, variables: Record<string, string> },
    ): sm.Secret | undefined {

        if (!props.variables) {
            return undefined
        }

        return new sm.Secret(scope, `${logicalId}SecretVariables`, {
            secretName: props.name,
            secretObjectValue: Object.entries(props.variables).reduce((acc: {
                [key: string]: cdk.SecretValue
            }, [key, value]) => {
                acc[key] = cdk.SecretValue.unsafePlainText(value)
                return acc
            }, {})
        })
    }

    static transformSecretToEcsSecretVariables(
        secret: sm.ISecret | undefined,
        variables: Record<string, string>
    ): Record<string, ecs.Secret> {
        if (!secret) return {}

        return Object.keys(variables).reduce((acc: { [key: string]: ecs.Secret }, key) => {
            acc[key] = ecs.Secret.fromSecretsManager(secret!, key);
            return acc;
        }, {})
    }
}