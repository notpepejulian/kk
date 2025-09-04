import { Repository } from 'aws-cdk-lib/aws-ecr'
import * as data from './data'

export const stacks = {
    vpc: `${data.project}-vpc-cfnstack-${data.env}`,
    common: `${data.project}-common-cfnstack-${data.env}`,
    database: `${data.project}-database-cfnstack-${data.env}`,
    firewall: `${data.project}-firewall-cfnstack-${data.env}`,
    ecs: `${data.project}-ecs-cfnstack-${data.env}`,
    cloudfront: `${data.project}-cloudfront-cfnstack-${data.env}`,
    s3: `${data.project}-s3-cfnstack-${data.env}`,
    peering: `${data.project}-peering-cfnstack-${data.env}`,
    efs: `${data.project}-efs-cfnstack-${data.env}`,
}

export const network = {
    networkAcl: `${data.project}-network-acl-${data.env}`,
    peering: `${data.project}-vpc-peering-to-shared-${data.env}`,
    vpc: `srs-${data.project}-vpc-${data.env}`,
}

export const cdn = {
    distribution: `${data.project}-cloudfront-${data.env}`,
    oac: `${data.project}-cloudfront-oac-${data.env}`,
    responsePolicy: `${data.project}-cloudfront-response-policy-${data.env}`,
}

export const sg = {
    endpoints: `${data.project}-vpc-endpoint-sg-${data.env}`,
    alb: `${data.project}-alb-sg-${data.env}`,
    tasks: {
        wordpress: `${data.project}-wordpress-ecs-sg-${data.env}`,
    }
}

export const database = {
    subnetGroup: `${data.project}-isolated-subnets-${data.env}`,
    parameterGroup: `${data.project}-parameter-group-${data.env}`,
    securityGroup: `${data.project}-db-sg-${data.env}`,
    rootSecret: `${data.project}-aurora-admin-rdssecret-${data.env}`,
    appSecret: `${data.project}-aurora-app-rdssecret-${data.env}`,
    cluster: `${data.project}-cluster-aurora-${data.env}`,
    monitoringRole: `${data.project}-monitoring-role-${data.env}`,
    writer: `${data.project}-writer-aurora-${data.env}`,
    defaultDatabaseName: `eval_${data.env}`
}

export const ecs = {
    cluster: `${data.project}-ecs-cluster-${data.env}`,
    executionRole: `${data.project}-ecs-execution-role-${data.env}`,
    tasks: {
        wordpress: {
            logging: `${data.project}-wordpress-log-group-${data.env}`,
            taskDefinition: `${data.project}-wordpress-ecstask-${data.env}`,
            taskRole: `${data.project}-wordpress-task-role-${data.env}`,
            service: `${data.project}-wordpress-service-${data.env}`,
            secret: `${data.project}-wordpress-secrets-${data.env}`,
            repository: `${data.project}-wordpress-repository-${data.env}`,
        },
    }
}

export const elb = {
    alb: `${data.project}-alb-${data.env}`,
    tg: `${data.project}-tg-${data.env}`,
}

export const waf = {
    shield: `${data.project}-waf-shield-${data.env}`,
    webAcl: `${data.project}-waf-web-acl-${data.env}`,
    visibilityMetricName: `${data.project}-waf-metric-visibility-${data.env}`,
    natGatewayIpSet: `${data.project}-waf-nat-gateway-ip-set-${data.env}`,
    rules: {
        geoBlocking: `${data.project}-waf-rule-geo-blocking-${data.env}`,
        labelSanomaNetworkIps: `${data.project}-waf-rule-label-sanoma-network-ips-${data.env}`,
        labelSanomaVulnerabilitiesScannersIps: `${data.project}-waf-rule-label-sanoma-vulnerabilities-scanners-ips-${data.env}`,
        labelDatadogIps: `${data.project}-waf-rule-label-datadog-ips-${data.env}`,
        labelNatGatewayIps: `${data.project}-waf-rule-label-nat-gateway-ips-${data.env}`,
        labelKnownFalsePositiveMcsLogo: `${data.project}-waf-rule-label-known-false-positive-McsLogo-${data.env}`,
        labelKnownFalsePositiveMcsGesImportBatchTemplates: `${data.project}-waf-rule-label-known-false-positive-McsGesImportBatchTemplates-${data.env}`,
        labelKnownFalsePositiveMcsFile: `${data.project}-waf-rule-label-known-false-positive-McsFile-${data.env}`,
        labelKnownFalsePositiveMcsQuestion: `${data.project}-waf-rule-label-known-false-positive-McsQuestion-${data.env}`,
        labelKnownFalsePositiveMcsAdminQuestion: `${data.project}-waf-rule-label-known-false-positive-McsAdminQuestion-${data.env}`,
        labelKnownFalsePositiveMcsGesExamPDF: `${data.project}-waf-rule-label-known-false-positive-McsGesExamPDF-${data.env}`,
        labelKnownFalsePositiveEvlFilesImg: `${data.project}-waf-rule-label-known-false-positive-McsEvlFilesImg-${data.env}`,
        dropOversizeHeaders: `${data.project}-waf-rule-drop-oversize-headers-${data.env}`,
        dropOversizeCookies: `${data.project}-waf-rule-drop-oversize-cookies-${data.env}`,
        dropOversizeRequestBody64KiB: `${data.project}-waf-rule-drop-oversize-request-body-64kib-${data.env}`,
        dropOversizeRequestBody48KiB: `${data.project}-waf-rule-drop-oversize-request-body-48kib-${data.env}`,
        dropOversizeRequestBody32KiB: `${data.project}-waf-rule-drop-oversize-request-body-32kib-${data.env}`,
        dropOversizeRequestBody16KiB: `${data.project}-waf-rule-drop-oversize-request-body-16kib-${data.env}`,
        dropLessThanGreaterThanInUriPath: `${data.project}-waf-rule-drop-less-than-greater-than-in-uri-path-${data.env}`,
        dropCurlyBracketsInUriPath: `${data.project}-waf-rule-drop-curly-brackets-in-uri-path-${data.env}`,
        dropEncodedPercentageSignInUriPath: `${data.project}-waf-rule-drop-encoded-percentage-sign-in-uri-path-${data.env}`,
        allowSanomaVulnerabilitiesScannersIps: `${data.project}-waf-rule-allow-sanoma-vulnerabilities-scanners-ips-${data.env}`,
        allowSanomaNetworkIps: `${data.project}-waf-rule-allow-sanoma-network-ips-${data.env}`,
        allowDatadogIps: `${data.project}-waf-rule-allow-datadog-ips-${data.env}`,
        allowNatGatewayIps: `${data.project}-waf-rule-allow-nat-gateway-ips-${data.env}`,
        awsManagedRulesAmazonIpReputationList: `${data.project}-waf-rule-aws-managed-rules-amazon-ip-reputation-list-${data.env}`,
        awsManagedRulesAnonymousIpList: `${data.project}-waf-rule-aws-managed-rules-anonymous-ip-list-${data.env}`,
        awsManagedRulesAdminProtectionRuleSet: `${data.project}-waf-rule-aws-managed-rules-admin-protection-rule-set-${data.env}`,
        awsManagedRulesPHPRuleSet: `${data.project}-waf-rule-aws-managed-rules-php-rule-set-${data.env}`,
        awsManagedRulesLinuxRuleSet: `${data.project}-waf-rule-aws-managed-rules-linux-rule-set-${data.env}`,
        awsManagedRulesUnixRuleSet: `${data.project}-waf-rule-aws-managed-rules-unix-rule-set-${data.env}`,
        awsManagedRulesCommonRuleSet: `${data.project}-waf-rule-aws-managed-rules-common-rule-set-${data.env}`,
        awsManagedRulesCommonRuleSetSelectiveBlock: `${data.project}-waf-rule-aws-managed-rules-common-rule-set-selective-block-${data.env}`,
        awsManagedRulesAnonymousIpListSelectiveBlock: `${data.project}-waf-rule-aws-managed-rules-anonymous-ip-list-selective-block-${data.env}`,
        geoblockingSelectiveBlock: `${data.project}-waf-rule-geo-blocking-selective-block-${data.env}`,
        awsManagedRulesKnownBadInputsRuleSet: `${data.project}-waf-rule-aws-managed-rules-known-bad-inputs-rule-set-${data.env}`,
        awsManagedRulesSQLiRuleSet: `${data.project}-waf-rule-aws-managed-rules-sqli-rule-set-${data.env}`,
    },
}

export const efs = {
    wordpress: `${data.project}-wordpress-efs-${data.env}`
}