import * as iam from 'aws-cdk-lib/aws-iam';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';

export class BucketPolicies {
    static getCommonPolicies(bucket: s3.Bucket): PolicyStatement[] {
        return [
            new iam.PolicyStatement({
                effect: iam.Effect.DENY,
                principals: [new iam.StarPrincipal()],
                actions: ['s3:*'],
                resources: [bucket.bucketArn, bucket.arnForObjects('*'),],
                conditions: {
                    Bool: {
                        'aws:SecureTransport': 'false',
                    }
                }
            }),
            new iam.PolicyStatement({
                effect: iam.Effect.DENY,
                principals: [new iam.StarPrincipal()],
                actions: ['s3:*'],
                resources: [bucket.bucketArn, bucket.arnForObjects('*'),],
                conditions: {
                    NumericLessThan: {
                        's3:TlsVersion': '1.2',
                    }
                }
            }),
            new iam.PolicyStatement({
                effect: iam.Effect.DENY,
                principals: [new iam.StarPrincipal()],
                actions: ['s3:*'],
                resources: [bucket.bucketArn, bucket.arnForObjects('*'),],
                conditions: {
                    StringNotEqualsIfExists: {
                        's3:signatureversion': 'AWS4-HMAC-SHA256',
                    }
                }
            })
        ]
    }

    static getBucketPolicyForCloudFront(
        bucket: s3.Bucket,
        distribution: string,
        account: string
    ): PolicyStatement {
        return new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
            actions: ['s3:GetObject'],
            resources: [`${bucket.bucketArn}/*`],
            conditions: {
                StringEquals: {
                    'AWS:SourceArn': `arn:aws:cloudfront::${account}:distribution/${distribution}`
                }
            }
        })
    }
}