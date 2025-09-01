import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';

export class S3Stack extends cdk.Stack {
    private readonly bucketAccessLogs: s3.IBucket;

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);
        this.bucketAccessLogs = this.retrieveBucketAccessLogs();
    }

    private retrieveBucketAccessLogs(): s3.IBucket {
        return s3.Bucket.fromBucketArn(this, "BucketAccessLogs", `arn:aws:s3:::s3logs-${this.account}-${this.region}`);
    }
}