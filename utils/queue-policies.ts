import * as iam from 'aws-cdk-lib/aws-iam';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import * as sqs from 'aws-cdk-lib/aws-sqs';

export class QueuePolicies {
    static getCommonPolicies(queue: sqs.IQueue): PolicyStatement[] {
        return [
            new iam.PolicyStatement({
                effect: iam.Effect.DENY,
                principals: [new iam.StarPrincipal()],
                actions: ['sqs:*'],
                resources: [queue.queueArn],
                conditions: {
                    Bool: {
                        'aws:SecureTransport': 'false',
                    }
                }
            }),
        ]
    }
}