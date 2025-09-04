export const env: string = process.env.bamboo_ENV!;
export const project: string = process.env.bamboo_PROJECT!;


/**
 * Shared resources
 */
export const ipSets = {
    sanomaNetworksIps: {
        arn: 'arn:aws:wafv2:us-east-1:026794415238:global/rulegroup/srs-shared-waf-sanoma-rulegroup/210338ec-c7f8-41de-8926-d182d297a62a',
        namespace: 'awswaf:026794415238:rulegroup:srs-shared-waf-sanoma-rulegroup',
    },
    sanomaVulnerabilityScannerIps: {
        arn: 'arn:aws:wafv2:us-east-1:026794415238:global/rulegroup/srs-shared-waf-vulnerabilityscanner-rulegroup/bb5ac11d-1789-4863-8c72-8f26ee3bf679',
        namespace: 'awswaf:026794415238:rulegroup:srs-shared-waf-vulnerabilityscanner-rulegroup',
    },
    datadogIps: {
        arn: 'arn:aws:wafv2:us-east-1:026794415238:global/rulegroup/srs-shared-waf-datadog-rulegroup/04bc155f-83f3-431a-84ea-128b30a42da9',
        namespace: 'awswaf:026794415238:rulegroup:srs-shared-waf-datadog-rulegroup'
    }
}

// export const vpcId: string = process.env.bamboo_VPC_ID!;
export const sharedVpcCidr: string = process.env.bamboo_SHARED_VPC_CIDR!

export const peering = {
    accountId: process.env.bamboo_SHARED_PEERING_ACCOUNT_ID!,
    vpcId: process.env.bamboo_SHARED_PEERING_VPC_ID!,
    roleArn: process.env.bamboo_SHARED_PEERING_ROLE_ARN!,
    privateSubnetsCidr: process.env.bamboo_SHARED_PEERING_PRIVATE_SUBNETS_CIDR!.split(','),
}

type VpcDataType = {
    vpcCidr: string;
    subnetsPublicCidr: string[];
    subnetsPrivateCidr: string[];
    subnetsIsolatedCidr: string[];
};
export const vpc: Record<string, VpcDataType> = {
    //**  MUJERES PROTAGONOISTAS NO REQUIERE DEV NI PRE **//
    pro: {
        vpcCidr: "172.16.194.0/21",
        subnetsPublicCidr: ["172.16.194.0/24", "172.16.195.0/24"],
        subnetsPrivateCidr: ["172.16.196.0/24", "172.16.197.0/24"],
        subnetsIsolatedCidr: ["172.16.199.0/24", "172.16.200.0/24"],
        // Backup : ["172.16.198.0/24","172.16.201.0/24"]
    },
}

/**
 * Application stacks
 */

export const cloudfrontDomains: Record<string, string[]> = {
    pro: [
            "",
            "",
            "",
            ""
        ],
};

export const AccessControlDomains: Record<string, string[]> = {
    pro: [
        "mujeresprotagonistas.santillana.es",
        "testmujeresprotagonistas.santillana.es"
    ],
};


export const databaseInstanceType: string = process.env.bamboo_DATABASE_INSTANCE_TYPE!;
export const cloudfrontCertificateArn: string = process.env.bamboo_CLOUDFRONT_CERTIFICATE_ARN!;
export const cloudfrontCustomHeaderValue: string = process.env.bamboo_CLOUDFRONT_CUSTOM_SECRET_HEADER_VALUE!;
export const albCertificateArns: string[] = process.env.bamboo_ALB_CERTIFICATE_ARNS!.split(',')


// const sharedVariables = {
//     APIBOOK_PASSWORD: process.env.bamboo_SHARED_SERVICE_VARIABLES_APIBOOK_PASSWORD!,
//     APP_DEBUG: process.env.bamboo_SHARED_SERVICE_VARIABLES_APP_DEBUG!,
//     APP_ENV: process.env.bamboo_SHARED_SERVICE_VARIABLES_APP_ENV!,
//     APP_SECRET: process.env.bamboo_SHARED_SERVICE_VARIABLES_APP_SECRET!,
//     CHROME_PATH: process.env.bamboo_SHARED_SERVICE_VARIABLES_CHROME_PATH!,
//     DATABASE_URL: process.env.bamboo_SHARED_SERVICE_VARIABLES_DATABASE_URL!,
//     JWT_PASSPHRASE: process.env.bamboo_SHARED_SERVICE_VARIABLES_JWT_PASSPHRASE!,
//     JWT_PRIVATE_KEY_PATH: process.env.bamboo_SHARED_SERVICE_VARIABLES_JWT_PRIVATE_KEY_PATH!,
//     JWT_PUBLIC_KEY_PATH: process.env.bamboo_SHARED_SERVICE_VARIABLES_JWT_PUBLIC_KEY_PATH!,
//     WKHTMLTOIMAGE_PATH: process.env.bamboo_SHARED_SERVICE_VARIABLES_WKHTMLTOIMAGE_PATH!,
//     WKHTMLTOPDF_PATH: process.env.bamboo_SHARED_SERVICE_VARIABLES_WKHTMLTOPDF_PATH!
// }

export const services = {
    wordpress: {
        imageTag: process.env.bamboo_SHARED_SERVICE_IMAGE_TAG!,
    }
}