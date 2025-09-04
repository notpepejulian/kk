#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import 'source-map-support/register';
import * as naming from "../bin/naming";
import * as data from "../bin/data";
import * as aspects from "./aspects";
import { VpcStack } from "../lib/network/vpc-stack";
import { S3Stack } from "../lib/storage/s3-logs-stack"
import { CommonStack } from "../lib/network/common-stack";
import { DatabaseStack } from "../lib/database/database-stack";
import { ApplicationFirewallStack } from "../lib/network/waf-stack";
import { ComputeStack } from "../lib/compute/service-stack";
import { EfsStack } from "../lib/storage/efs";

const vpcStackName = naming.stacks.vpc;
const ecsStackName = naming.stacks.ecs;
const commonStackName = naming.stacks.common;
const dbStackName = naming.stacks.database;
const s3StackName = naming.stacks.s3;
const firewallStackName = naming.stacks.firewall;
const peeringStackName = naming.stacks.peering;
const efsStackName = naming.stacks.efs;
const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

if (process.env.bamboo_RELEASE === "true") {

  const vpcStack = new VpcStack(app, vpcStackName, {
    env: env,
  });

  const databaseStack = new DatabaseStack(app, dbStackName, {
    env: env,
  });
  databaseStack.addDependency(vpcStack);

  const s3Stack = new S3Stack(app, s3StackName, {
    env: env
  })

  const commonStack = new CommonStack(app, commonStackName, {
    env: env,
  });

  const applicationFirewallStack = new ApplicationFirewallStack(app, firewallStackName, {
    env: env,
  });

  const computeStack = new ComputeStack(app, ecsStackName, {
    env: env,
  });

  const peeringStack = new ComputeStack(app, peeringStackName, {
    env: env,
  });
  peeringStack.addDependency(vpcStack);

  const efsStack = new EfsStack(app, efsStackName, {
    env: env,
  });
  efsStack.addDependency(vpcStack);
}

const appAspects = cdk.Aspects.of(app);

appAspects.add(
  new aspects.ApplyTags({
    env: data.env,
    project: "srs-mujeresprotagonistas",
    bitbucketRepository: "srs-mujeresprotagonistas-infra",
    owner: "Adrian Garcia agarciag@sanoma.com",
    devTeam: "",
  })
);