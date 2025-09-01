import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cdk from "aws-cdk-lib";

export class BucketLifecycle {
    static getCommonRules(env: string): s3.LifecycleRule[] {
        return [
            {
                id: "daily-housekeeping",
                enabled: true,
                expiredObjectDeleteMarker: true,
                abortIncompleteMultipartUploadAfter: cdk.Duration.days(3)
            },
            {
                id: "expire-noncurrent-objects",
                enabled: true,
                noncurrentVersionExpiration: cdk.Duration.days(env === "pro" ? 7 : 3),
                noncurrentVersionsToRetain: 5
            },
            {
                id: "transition-current-objects-to-intelligent-tiering",
                enabled: true,
                objectSizeGreaterThan: 131072,
                transitions: [
                    {
                        storageClass: s3.StorageClass.INTELLIGENT_TIERING,
                        transitionAfter: cdk.Duration.days(0)
                    }
                ]
            }
        ]
    }
}