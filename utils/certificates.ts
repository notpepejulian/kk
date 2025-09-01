import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from "constructs";

export class Certificates {
    static retrieveFromArn(
        scope: Construct,
        certificateArns: string[]
    ): acm.ICertificate[] {
        return certificateArns.map((arn, index) => acm.Certificate.fromCertificateArn(scope, `AcmCertificate-${index}`, arn));
    }
}