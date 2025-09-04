import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as efs from 'aws-cdk-lib/aws-efs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as naming from '../../bin/naming';
import * as data from '../../bin/data';

export class EfsStack extends cdk.Stack {

    private readonly vpc: ec2.IVpc;
    public readonly fileSystem: efs.FileSystem;
    public readonly accessPoint: efs.AccessPoint;

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        this.vpc = this.retrieveVpc();
        this.fileSystem = this.createEfsFileSystem();
        this.accessPoint = this.createAccessPoint();
    }

    private retrieveVpc(): ec2.IVpc {
        return ec2.Vpc.fromLookup(this, "Vpc", { vpcId: this.vpc.vpcId });
    }

    private createEfsFileSystem(): efs.FileSystem {
        return new efs.FileSystem(this, 'WordpressEfs', {
            vpc: this.vpc,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
            throughputMode: efs.ThroughputMode.BURSTING,
            encrypted: true,
            fileSystemName: naming.efs.wordpress,
            lifecyclePolicy: efs.LifecyclePolicy.AFTER_14_DAYS,
        });
    }

    private createAccessPoint(): efs.AccessPoint {
        return new efs.AccessPoint(this, "WordpressAccessPoint", {
            fileSystem: this.fileSystem,
            path: "/wordpress",
            posixUser: {
                gid: "33",
                uid: "33",
            },
            createAcl: {
                ownerGid: "33",
                ownerUid: "33",
                permissions: "0755",
            },
        });
    }
}