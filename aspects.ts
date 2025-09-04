import { IAspect, TagManager } from "aws-cdk-lib";
import * as data from "../bin/data";
import { IConstruct } from "constructs";
import { CfnDBCluster, CfnDBInstance } from "aws-cdk-lib/aws-rds";
import { CfnInstance } from "aws-cdk-lib/aws-ec2";
import { CfnAutoScalingGroup } from "aws-cdk-lib/aws-autoscaling";
import { CfnService } from "aws-cdk-lib/aws-ecs";

type Tags = { [key: string]: string } & {
    env: string;
    project: string;
    bitbucketRepository: string;
    owner: string;
    devTeam: string;
};

export class ApplyTags implements IAspect {

    private tags: Tags;

    constructor(tags: Tags) {
        this.tags = tags;
    }

    visit(node: IConstruct): void {

        if (!TagManager.isTaggable(node)) {
            return;
        }

        Object.entries(this.tags).forEach(([key, value]) => node.tags.setTag(key, value));

        if (
            data.env != "pro" &&
            (
                node instanceof CfnDBInstance ||
                node instanceof CfnDBCluster ||
                node instanceof CfnInstance ||
                node instanceof CfnAutoScalingGroup ||
                node instanceof CfnService
            )
        ) {
            node.tags.setTag('shutdown', `true`);
        }
    }
}