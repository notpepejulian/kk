import { Arn, Stack } from 'aws-cdk-lib';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

interface SsmParameterStoreReaderProps {
    parameterName: string
    region: string
}

export class SsmParameterStoreReader extends cr.AwsCustomResource {
    constructor(scope: Construct, name: string, props: SsmParameterStoreReaderProps) {

        const {parameterName, region} = props;

        const onUpdate: cr.AwsSdkCall = {
            region,
            service: 'SSM',
            action: 'getParameter',
            parameters: {Name: parameterName,},
            physicalResourceId: cr.PhysicalResourceId.of(Date.now().toString()),
        };

        const policy = cr.AwsCustomResourcePolicy.fromSdkCalls({
            resources: [
                Arn.format(
                    {
                        service: 'ssm',
                        region: props.region,
                        resource: 'parameter',
                        resourceName: parameterName.slice(0, 1) == '/' ? parameterName.slice(1) : parameterName,
                    },
                    Stack.of(scope),
                ),
            ],
        });

        super(scope, name, {onUpdate, policy,});
    }

    get value(): string {
        return this.getResponseField('Parameter.Value').toString();
    }
}