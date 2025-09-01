import { Construct } from "constructs";
import * as ssm from "aws-cdk-lib/aws-ssm";

export const createParam = (
	construct: Construct,
	logicalId: string,

	name: string,
	value: string,
) => {
	const param = new ssm.StringParameter(construct, logicalId, {
		parameterName: `/cdk/output/${name}`,
		stringValue: value,
	});

	return param;
};

export const getParam = (construct: Construct, name: string) => {
	const param = ssm.StringParameter.valueFromLookup(
		construct,
		`/cdk/output/${name}`,
	);

	return param;
};