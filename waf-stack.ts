import * as cdk from "aws-cdk-lib"
import { Construct } from "constructs"
import * as waf from "aws-cdk-lib/aws-wafv2"
import * as data from "../../bin/data"
import * as naming from "../../bin/naming"
import * as ssm from "aws-cdk-lib/aws-ssm"

export class ApplicationFirewallStack extends cdk.Stack {

    private priorityAfterShieldAdvanced: number = 10000000
    private priorityDefaultRules: number = 0
    private readonly wafWebAcl: waf.CfnWebACL
    private natGatewayIpSet: waf.CfnIPSet

    constructor(scope: Construct, id: string, props: cdk.StackProps) {
        super(scope, id, props);
        const natGatewayIpList = '52.19.141.201/32,63.32.245.219/32' // !!!
        this.natGatewayIpSet = new waf.CfnIPSet(this, 'natGatewayIpSet', {
            name: naming.waf.natGatewayIpSet,
            description: naming.waf.natGatewayIpSet,
            scope: 'CLOUDFRONT',
            ipAddressVersion: 'IPV4',
            addresses: cdk.Fn.split(',', natGatewayIpList!),
            tags: [
                {
                    key: 'Name',
                    value: naming.waf.natGatewayIpSet,
                },
            ],
        });
        this.wafWebAcl = this.createWafWebAcl()
        this.enableLoggingForWaf()
        this.exportValuesToParameterStore()
    }

    private createWafWebAcl(): waf.CfnWebACL {

        const defaultAction = data.env != 'pro' ? { block: {} } : { allow: {} }

        const rules: waf.CfnWebACL.RuleProperty[] = [
            ...this.defaultRules(),
            // ....
        ]

        return new waf.CfnWebACL(this, 'CloudFrontWafWebAcl', {
            name: naming.waf.webAcl,
            defaultAction: defaultAction,
            scope: 'CLOUDFRONT',
            rules: rules,
            associationConfig: { requestBody: { CLOUDFRONT: { defaultSizeInspectionLimit: 'KB_16', }, } },
            visibilityConfig: {
                cloudWatchMetricsEnabled: true,
                sampledRequestsEnabled: true,
                metricName: naming.waf.visibilityMetricName,
            },
        })
    }

    private enableLoggingForWaf(): void {
        new waf.CfnLoggingConfiguration(this, 'WafLogging', {
            resourceArn: this.wafWebAcl.attrArn,
            logDestinationConfigs: [`arn:aws:s3:::aws-waf-logs-${this.account}-eu-west-1`],
            redactedFields: []
        })
    }

    private exportValuesToParameterStore(): void {
        new ssm.StringParameter(this, "WafWebAclArn", {
            parameterName: `/cdk/output/${data.project}/${data.env}/app-waf-web-acl-arn`,
            stringValue: this.wafWebAcl.attrArn,
        })
    }

    private defaultRules(): waf.CfnWebACL.RuleProperty[] {
        return [
            {
                name: naming.waf.rules.labelSanomaNetworkIps,
                priority: this.priorityDefaultRules++,
                overrideAction: { none: {} },
                statement: {
                    ruleGroupReferenceStatement: {
                        arn: data.ipSets.sanomaNetworksIps.arn,
                    },
                },
                visibilityConfig: {
                    cloudWatchMetricsEnabled: true,
                    metricName: naming.waf.rules.labelSanomaNetworkIps,
                    sampledRequestsEnabled: false,
                },
            },
            {
                name: naming.waf.rules.labelSanomaVulnerabilitiesScannersIps,
                priority: this.priorityDefaultRules++,
                overrideAction: { none: {} },
                statement: {
                    ruleGroupReferenceStatement: {
                        arn: data.ipSets.sanomaVulnerabilityScannerIps.arn,
                    },
                },
                visibilityConfig: {
                    cloudWatchMetricsEnabled: true,
                    metricName: naming.waf.rules.labelSanomaVulnerabilitiesScannersIps,
                    sampledRequestsEnabled: false,
                },
            },
            {
                name: naming.waf.rules.labelDatadogIps,
                priority: this.priorityDefaultRules++,
                overrideAction: { none: {} },
                statement: {
                    ruleGroupReferenceStatement: {
                        arn: data.ipSets.datadogIps.arn,
                    },
                },
                visibilityConfig: {
                    cloudWatchMetricsEnabled: true,
                    metricName: naming.waf.rules.labelDatadogIps,
                    sampledRequestsEnabled: false,
                },
            },
            {
                name: naming.waf.rules.labelNatGatewayIps,
                priority: this.priorityDefaultRules++,
                action: { count: {} },
                ruleLabels: [{ name: "trusted-ip:nat-gateway-ips", }],
                statement: {
                    ipSetReferenceStatement: {
                        arn: this.natGatewayIpSet.attrArn,
                    },
                },
                visibilityConfig: {
                    cloudWatchMetricsEnabled: true,
                    metricName: naming.waf.rules.labelNatGatewayIps,
                    sampledRequestsEnabled: false,
                },
            },
            {
                name: naming.waf.rules.labelKnownFalsePositiveMcsLogo,
                priority: this.priorityDefaultRules++,
                action: { count: {}, },
                ruleLabels: [{ name: "known-false-positives:mcs-logo", },],
                statement: {
                    andStatement: {
                        statements: [
                            {
                                byteMatchStatement: {
                                    fieldToMatch: { method: {} },
                                    positionalConstraint: 'EXACTLY',
                                    searchString: 'POST',
                                    textTransformations: [
                                        { priority: 10, type: 'NONE' }
                                    ],
                                },
                            },
                            {
                                regexMatchStatement: {
                                    fieldToMatch: { uriPath: {} },
                                    regexString: '^/mcs/logo$',
                                    textTransformations: [
                                        { priority: 10, type: 'URL_DECODE' }
                                    ],
                                },
                            },
                        ],
                    },
                },
                visibilityConfig: {
                    cloudWatchMetricsEnabled: true,
                    metricName: naming.waf.rules.labelKnownFalsePositiveMcsLogo,
                    sampledRequestsEnabled: false,
                },
            },
            {
                name: naming.waf.rules.labelKnownFalsePositiveMcsGesImportBatchTemplates,
                priority: this.priorityDefaultRules++,
                action: { count: {}, },
                ruleLabels: [{ name: "known-false-positives:mcs-ges-import-batchtemplates", },],
                statement: {
                    andStatement: {
                        statements: [
                            {
                                byteMatchStatement: {
                                    fieldToMatch: { method: {} },
                                    positionalConstraint: 'EXACTLY',
                                    searchString: 'POST',
                                    textTransformations: [
                                        { priority: 10, type: 'NONE' }
                                    ],
                                },
                            },
                            {
                                regexMatchStatement: {
                                    fieldToMatch: { uriPath: {} },
                                    regexString: '^/mcs/GES/importBatchTemplates$',
                                    textTransformations: [
                                        { priority: 10, type: 'URL_DECODE' }
                                    ],
                                },
                            },
                        ],
                    },
                },
                visibilityConfig: {
                    cloudWatchMetricsEnabled: true,
                    metricName: naming.waf.rules.labelKnownFalsePositiveMcsGesImportBatchTemplates,
                    sampledRequestsEnabled: false,
                },
            },
            {
                name: naming.waf.rules.labelKnownFalsePositiveMcsFile,
                priority: this.priorityDefaultRules++,
                action: { count: {}, },
                ruleLabels: [{ name: "known-false-positives:mcs-file", },],
                statement: {
                    andStatement: {
                        statements: [
                            {
                                byteMatchStatement: {
                                    fieldToMatch: { method: {} },
                                    positionalConstraint: 'EXACTLY',
                                    searchString: 'POST',
                                    textTransformations: [
                                        { priority: 10, type: 'NONE' }
                                    ],
                                },
                            },
                            {
                                regexMatchStatement: {
                                    fieldToMatch: { uriPath: {} },
                                    regexString: '^/mcs/file$',
                                    textTransformations: [
                                        { priority: 10, type: 'URL_DECODE' }
                                    ],
                                },
                            },
                        ],
                    },
                },
                visibilityConfig: {
                    cloudWatchMetricsEnabled: true,
                    metricName: naming.waf.rules.labelKnownFalsePositiveMcsFile,
                    sampledRequestsEnabled: false,
                },
            },
            {
                name: naming.waf.rules.labelKnownFalsePositiveMcsQuestion,
                priority: this.priorityDefaultRules++,
                action: { count: {}, },
                ruleLabels: [{ name: "known-false-positives:mcs-question", },],
                statement: {
                    andStatement: {
                        statements: [
                            {
                                orStatement: {
                                    statements: [
                                        {
                                            byteMatchStatement: {
                                                fieldToMatch: { method: {} },
                                                positionalConstraint: "EXACTLY",
                                                searchString: "POST",
                                                textTransformations: [
                                                    { priority: 10, type: "NONE" },
                                                ],
                                            },
                                        },
                                        {
                                            byteMatchStatement: {
                                                fieldToMatch: { method: {} },
                                                positionalConstraint: "EXACTLY",
                                                searchString: "PUT",
                                                textTransformations: [
                                                    { priority: 10, type: "NONE" },
                                                ],
                                            },
                                        },

                                    ],
                                },
                            },
                            {
                                regexMatchStatement: {
                                    fieldToMatch: { uriPath: {} },
                                    regexString: "^/mcs/(?:GES/)?question(\\/[0-9]+)?$",
                                    textTransformations: [
                                        { priority: 10, type: "URL_DECODE" },
                                    ],
                                },
                            },
                        ],
                    },
                },
                visibilityConfig: {
                    cloudWatchMetricsEnabled: true,
                    metricName: naming.waf.rules.labelKnownFalsePositiveMcsQuestion,
                    sampledRequestsEnabled: false,
                },
            },
            {
                name: naming.waf.rules.labelKnownFalsePositiveMcsAdminQuestion,
                priority: this.priorityDefaultRules++,
                action: { count: {}, },
                ruleLabels: [{ name: "known-false-positives:mcs-admin-question", },],
                statement: {
                    andStatement: {
                        statements: [
                            {
                                orStatement: {
                                    statements: [
                                        {
                                            byteMatchStatement: {
                                                fieldToMatch: { method: {} },
                                                positionalConstraint: "EXACTLY",
                                                searchString: "POST",
                                                textTransformations: [
                                                    { priority: 10, type: "NONE" },
                                                ],
                                            },
                                        },
                                        {
                                            byteMatchStatement: {
                                                fieldToMatch: { method: {} },
                                                positionalConstraint: "EXACTLY",
                                                searchString: "PUT",
                                                textTransformations: [
                                                    { priority: 10, type: "NONE" },
                                                ],
                                            },
                                        },
                                    ]
                                }
                            },
                            {
                                regexMatchStatement: {
                                    fieldToMatch: { uriPath: {} },
                                    regexString: "^/mcs/(?:GES/)?admQuestion(\\/[0-9]+)?$",
                                    textTransformations: [
                                        { priority: 10, type: "URL_DECODE" },
                                    ],
                                },
                            },
                        ],
                    },
                },
                visibilityConfig: {
                    cloudWatchMetricsEnabled: true,
                    metricName: naming.waf.rules.labelKnownFalsePositiveMcsAdminQuestion,
                    sampledRequestsEnabled: false,
                },
            },
            {
                name: 'AWSManagedRulesAmazonIpReputationList',
                overrideAction: { none: {} },
                priority: this.priorityDefaultRules++,
                statement: {
                    managedRuleGroupStatement: {
                        name: 'AWSManagedRulesAmazonIpReputationList',
                        vendorName: 'AWS',
                        ruleActionOverrides: [
                            {
                                name: 'AWSManagedIPDDoSList',
                                actionToUse: {
                                    block: {},
                                }
                            }
                        ],
                        scopeDownStatement: {
                            andStatement: {
                                statements: [
                                    {
                                        notStatement: {
                                            statement: {
                                                labelMatchStatement: {
                                                    scope: 'LABEL',
                                                    key: `${data.ipSets.sanomaNetworksIps.namespace}:trusted-ip:sanoma`,
                                                },
                                            },
                                        },
                                    },
                                    {
                                        notStatement: {
                                            statement: {
                                                labelMatchStatement: {
                                                    scope: 'LABEL',
                                                    key: `${data.ipSets.sanomaVulnerabilityScannerIps.namespace}:trusted-ip:vulnerability-scanners`,
                                                },
                                            },
                                        },
                                    }
                                ]
                            }
                        },
                    },
                },
                visibilityConfig: {
                    cloudWatchMetricsEnabled: true,
                    metricName: naming.waf.rules.awsManagedRulesAmazonIpReputationList,
                    sampledRequestsEnabled: true,
                },
            },
            {
                name: 'AWSManagedRulesAnonymousIpList',
                priority: this.priorityDefaultRules++,
                statement: {
                    managedRuleGroupStatement: {
                        name: 'AWSManagedRulesAnonymousIpList',
                        vendorName: 'AWS',
                        scopeDownStatement: {
                            andStatement: {
                                statements: [
                                    {
                                        notStatement: {
                                            statement: {
                                                labelMatchStatement: {
                                                    scope: 'LABEL',
                                                    key: `${data.ipSets.sanomaNetworksIps.namespace}:trusted-ip:sanoma`,
                                                },
                                            },
                                        },
                                    },
                                    {
                                        notStatement: {
                                            statement: {
                                                labelMatchStatement: {
                                                    scope: 'LABEL',
                                                    key: `${data.ipSets.sanomaVulnerabilityScannerIps.namespace}:trusted-ip:vulnerability-scanners`,
                                                },
                                            },
                                        },
                                    }
                                ]
                            }
                        },
                    },
                },
                overrideAction: { none: {} },
                visibilityConfig: {
                    cloudWatchMetricsEnabled: true,
                    metricName: naming.waf.rules.awsManagedRulesAnonymousIpList,
                    sampledRequestsEnabled: true,
                },
            },
            {
                name: naming.waf.rules.dropOversizeHeaders,
                priority: this.priorityDefaultRules++,
                action: { block: {}, },
                statement: {
                    sizeConstraintStatement: {
                        fieldToMatch: {
                            headers: {
                                matchPattern: { all: {} },
                                matchScope: 'ALL',
                                oversizeHandling: 'MATCH',
                            },
                        },
                        comparisonOperator: 'GT',
                        size: 8192,
                        textTransformations: [
                            {
                                priority: 10,
                                type: 'NONE',
                            },
                        ],
                    },
                },
                visibilityConfig: {
                    cloudWatchMetricsEnabled: true,
                    metricName: naming.waf.rules.dropOversizeHeaders,
                    sampledRequestsEnabled: true,
                },
            },
            {
                name: naming.waf.rules.dropOversizeCookies,
                priority: this.priorityDefaultRules++,
                action: { block: {}, },
                statement: {
                    sizeConstraintStatement: {
                        fieldToMatch: {
                            headers: {
                                matchPattern: { all: {} },
                                matchScope: 'ALL',
                                oversizeHandling: 'MATCH',
                            },
                        },
                        comparisonOperator: 'GT',
                        size: 8192,
                        textTransformations: [
                            {
                                priority: 10,
                                type: 'NONE',
                            },
                        ],
                    },
                },
                visibilityConfig: {
                    cloudWatchMetricsEnabled: true,
                    metricName: naming.waf.rules.dropOversizeCookies,
                    sampledRequestsEnabled: true,
                },
            },
            {
                name: naming.waf.rules.dropOversizeRequestBody64KiB,
                priority: this.priorityDefaultRules++,
                action: { count: {} },
                statement: {
                    andStatement: {
                        statements: [
                            {
                                sizeConstraintStatement: {
                                    fieldToMatch: {
                                        body: {
                                            oversizeHandling: 'MATCH',
                                        },
                                    },
                                    comparisonOperator: 'GT',
                                    size: 65536,
                                    textTransformations: [
                                        {
                                            priority: 10,
                                            type: 'NONE',
                                        },
                                    ],
                                },
                            },
                            {
                                notStatement: {
                                    statement: {
                                        labelMatchStatement: {
                                            scope: 'NAMESPACE',
                                            key: 'known-oversized-body:',
                                        },
                                    },
                                },
                            },
                        ],
                    },
                },
                visibilityConfig: {
                    cloudWatchMetricsEnabled: true,
                    metricName: naming.waf.rules.dropOversizeRequestBody64KiB,
                    sampledRequestsEnabled: true,
                },
            },
            {
                name: naming.waf.rules.dropOversizeRequestBody48KiB,
                priority: this.priorityDefaultRules++,
                action: { count: {} },
                statement: {
                    andStatement: {
                        statements: [
                            {
                                sizeConstraintStatement: {
                                    fieldToMatch: {
                                        body: {
                                            oversizeHandling: 'MATCH',
                                        },
                                    },
                                    comparisonOperator: 'GT',
                                    size: 49152,
                                    textTransformations: [
                                        {
                                            priority: 10,
                                            type: 'NONE',
                                        },
                                    ],
                                },
                            },
                            {
                                notStatement: {
                                    statement: {
                                        labelMatchStatement: {
                                            scope: 'NAMESPACE',
                                            key: 'known-oversized-body:',
                                        },
                                    },
                                },
                            },
                        ],
                    },
                },
                visibilityConfig: {
                    cloudWatchMetricsEnabled: true,
                    metricName: naming.waf.rules.dropOversizeRequestBody48KiB,
                    sampledRequestsEnabled: true,
                },
            },
            {
                name: naming.waf.rules.dropOversizeRequestBody32KiB,
                priority: this.priorityDefaultRules++,
                action: { count: {} },
                statement: {
                    andStatement: {
                        statements: [
                            {
                                sizeConstraintStatement: {
                                    fieldToMatch: {
                                        body: {
                                            oversizeHandling: 'MATCH',
                                        },
                                    },
                                    comparisonOperator: 'GT',
                                    size: 32768,
                                    textTransformations: [
                                        {
                                            priority: 10,
                                            type: 'NONE',
                                        },
                                    ],
                                },
                            },
                            {
                                notStatement: {
                                    statement: {
                                        labelMatchStatement: {
                                            scope: 'NAMESPACE',
                                            key: 'known-oversized-body:',
                                        },
                                    },
                                },
                            },
                        ],
                    },
                },
                visibilityConfig: {
                    cloudWatchMetricsEnabled: true,
                    metricName: naming.waf.rules.dropOversizeRequestBody32KiB,
                    sampledRequestsEnabled: true,
                },
            },
            {
                name: naming.waf.rules.dropOversizeRequestBody16KiB,
                priority: this.priorityDefaultRules++,
                action: { count: {} },
                statement: {
                    andStatement: {
                        statements: [
                            {
                                sizeConstraintStatement: {
                                    fieldToMatch: {
                                        body: {
                                            oversizeHandling: 'MATCH',
                                        },
                                    },
                                    comparisonOperator: 'GT',
                                    size: 16384,
                                    textTransformations: [
                                        {
                                            priority: 10,
                                            type: 'NONE',
                                        },
                                    ],
                                },
                            },
                            {
                                notStatement: {
                                    statement: {
                                        labelMatchStatement: {
                                            scope: 'NAMESPACE',
                                            key: 'known-oversized-body:',
                                        },
                                    },
                                },
                            },
                        ],
                    },
                },
                visibilityConfig: {
                    cloudWatchMetricsEnabled: true,
                    metricName: naming.waf.rules.dropOversizeRequestBody16KiB,
                    sampledRequestsEnabled: true,
                },
            },
            {
                name: 'AWSManagedRulesCommonRuleSet',
                priority: this.priorityDefaultRules++,
                overrideAction: { none: {} },
                statement: {
                    managedRuleGroupStatement: {
                        name: 'AWSManagedRulesCommonRuleSet',
                        vendorName: 'AWS',
                        ruleActionOverrides: [
                            {
                                name: 'SizeRestrictions_BODY',
                                actionToUse: { count: {}, },
                            },
                            {
                                name: "CrossSiteScripting_BODY",
                                actionToUse: { count: {}, },
                            }
                        ],
                    },
                },
                visibilityConfig: {
                    cloudWatchMetricsEnabled: true,
                    metricName: naming.waf.rules.awsManagedRulesCommonRuleSet,
                    sampledRequestsEnabled: true,
                },
            },
            {
                name: 'AWSManagedRulesAdminProtectionRuleSet',
                priority: this.priorityDefaultRules++,
                overrideAction: { none: {} },
                statement: {
                    managedRuleGroupStatement: {
                        name: 'AWSManagedRulesAdminProtectionRuleSet',
                        vendorName: 'AWS',
                    },
                },
                visibilityConfig: {
                    cloudWatchMetricsEnabled: true,
                    metricName: naming.waf.rules.awsManagedRulesAdminProtectionRuleSet,
                    sampledRequestsEnabled: true,
                },
            },
            {
                name: 'AWSManagedRulesKnownBadInputsRuleSet',
                overrideAction: { none: {} },
                priority: this.priorityDefaultRules++,
                statement: {
                    managedRuleGroupStatement: {
                        name: 'AWSManagedRulesKnownBadInputsRuleSet',
                        vendorName: 'AWS',
                    },
                },
                visibilityConfig: {
                    cloudWatchMetricsEnabled: true,
                    metricName: naming.waf.rules.awsManagedRulesKnownBadInputsRuleSet,
                    sampledRequestsEnabled: true,
                },
            },
            {
                name: 'AWSManagedRulesSQLiRuleSet',
                priority: this.priorityDefaultRules++,
                overrideAction: { none: {} },
                statement: {
                    managedRuleGroupStatement: {
                        name: 'AWSManagedRulesSQLiRuleSet',
                        vendorName: 'AWS',
                    },
                },
                visibilityConfig: {
                    cloudWatchMetricsEnabled: true,
                    metricName: naming.waf.rules.awsManagedRulesSQLiRuleSet,
                    sampledRequestsEnabled: true,
                },
            },
            {
                name: 'AWSManagedRulesPHPRuleSet',
                overrideAction: { none: {} },
                priority: this.priorityDefaultRules++,
                statement: {
                    managedRuleGroupStatement: {
                        name: 'AWSManagedRulesPHPRuleSet',
                        vendorName: 'AWS',
                    },
                },
                visibilityConfig: {
                    cloudWatchMetricsEnabled: true,
                    metricName: naming.waf.rules.awsManagedRulesPHPRuleSet,
                    sampledRequestsEnabled: true,
                },
            },
            {
                name: naming.waf.rules.dropLessThanGreaterThanInUriPath,
                priority: this.priorityDefaultRules++,
                action: { block: {}, },
                statement: {
                    orStatement: {
                        statements: [
                            {
                                regexMatchStatement: {
                                    fieldToMatch: {
                                        uriPath: {},
                                    },
                                    regexString: '[<>]',
                                    textTransformations: [
                                        {
                                            priority: 10,
                                            type: 'NONE',
                                        },
                                    ],
                                },
                            },
                            {
                                regexMatchStatement: {
                                    fieldToMatch: {
                                        uriPath: {},
                                    },
                                    regexString: '[<>]',
                                    textTransformations: [
                                        {
                                            priority: 10,
                                            type: 'URL_DECODE',
                                        },
                                    ],
                                },
                            },
                            {
                                regexMatchStatement: {
                                    fieldToMatch: {
                                        uriPath: {},
                                    },
                                    regexString: '%(25)?3[cCeE]',
                                    textTransformations: [
                                        {
                                            priority: 10,
                                            type: 'NONE',
                                        },
                                    ],
                                },
                            },
                        ],
                    },
                },
                visibilityConfig: {
                    cloudWatchMetricsEnabled: true,
                    metricName: naming.waf.rules.dropLessThanGreaterThanInUriPath,
                    sampledRequestsEnabled: true,
                },
            },
            {
                name: naming.waf.rules.dropCurlyBracketsInUriPath,
                priority: this.priorityDefaultRules++,
                action: { block: {}, },
                statement: {
                    orStatement: {
                        statements: [
                            {
                                regexMatchStatement: {
                                    fieldToMatch: {
                                        uriPath: {},
                                    },
                                    regexString: '[{}|]',
                                    textTransformations: [
                                        {
                                            priority: 10,
                                            type: 'NONE',
                                        },
                                    ],
                                },
                            },
                            {
                                regexMatchStatement: {
                                    fieldToMatch: {
                                        uriPath: {},
                                    },
                                    regexString: '[{}|]',
                                    textTransformations: [
                                        {
                                            priority: 10,
                                            type: 'URL_DECODE',
                                        },
                                    ],
                                },
                            },
                            {
                                regexMatchStatement: {
                                    fieldToMatch: {
                                        uriPath: {},
                                    },
                                    regexString: '%(25)?7[bBcCdD]',
                                    textTransformations: [
                                        {
                                            priority: 10,
                                            type: 'NONE',
                                        },
                                    ],
                                },
                            },
                        ],
                    },
                },
                visibilityConfig: {
                    cloudWatchMetricsEnabled: true,
                    metricName: naming.waf.rules.dropCurlyBracketsInUriPath,
                    sampledRequestsEnabled: true,
                },
            },
            {
                name: naming.waf.rules.dropEncodedPercentageSignInUriPath,
                priority: this.priorityDefaultRules++,
                action: { block: {}, },
                statement: {
                    regexMatchStatement: {
                        fieldToMatch: {
                            uriPath: {},
                        },
                        regexString: '%25',
                        textTransformations: [
                            {
                                priority: 10,
                                type: 'NONE',
                            },
                        ],
                    },
                },
                visibilityConfig: {
                    cloudWatchMetricsEnabled: true,
                    metricName: naming.waf.rules.dropEncodedPercentageSignInUriPath,
                    sampledRequestsEnabled: true,
                },
            },
            {
                name: naming.waf.rules.awsManagedRulesLinuxRuleSet,
                priority: this.priorityDefaultRules++,
                overrideAction: { none: {}, },
                statement: {
                    managedRuleGroupStatement: {
                        name: 'AWSManagedRulesLinuxRuleSet',
                        vendorName: 'AWS',
                    },
                },
                visibilityConfig: {
                    cloudWatchMetricsEnabled: true,
                    metricName: naming.waf.rules.awsManagedRulesLinuxRuleSet,
                    sampledRequestsEnabled: true,
                },
            },
            {
                name: naming.waf.rules.awsManagedRulesUnixRuleSet,
                priority: this.priorityDefaultRules++,
                overrideAction: { none: {}, },
                statement: {
                    managedRuleGroupStatement: {
                        name: 'AWSManagedRulesUnixRuleSet',
                        vendorName: 'AWS',
                    },
                },
                visibilityConfig: {
                    cloudWatchMetricsEnabled: true,
                    metricName: naming.waf.rules.awsManagedRulesUnixRuleSet,
                    sampledRequestsEnabled: true,
                },
            },
            {
                name: naming.waf.rules.allowSanomaVulnerabilitiesScannersIps,
                priority: this.priorityDefaultRules++,
                action: { allow: {} },
                statement: {
                    labelMatchStatement: {
                        scope: 'LABEL',
                        key: `${data.ipSets.sanomaVulnerabilityScannerIps.namespace}:trusted-ip:vulnerability-scanners`,
                    },
                },
                visibilityConfig: {
                    cloudWatchMetricsEnabled: true,
                    metricName: naming.waf.rules.allowSanomaVulnerabilitiesScannersIps,
                    sampledRequestsEnabled: true,
                }
            },
            {
                name: naming.waf.rules.allowSanomaNetworkIps,
                priority: this.priorityDefaultRules++,
                action: { allow: {} },
                statement: {
                    labelMatchStatement: {
                        scope: 'LABEL',
                        key: `${data.ipSets.sanomaNetworksIps.namespace}:trusted-ip:sanoma`,
                    },
                },
                visibilityConfig: {
                    cloudWatchMetricsEnabled: true,
                    metricName: naming.waf.rules.allowSanomaNetworkIps,
                    sampledRequestsEnabled: false,
                }
            },
            {
                name: naming.waf.rules.allowDatadogIps,
                priority: this.priorityDefaultRules++,
                action: { allow: {} },
                statement: {
                    labelMatchStatement: {
                        scope: 'LABEL',
                        key: `${data.ipSets.datadogIps.namespace}:known-ip:datadog`,
                    },
                },
                visibilityConfig: {
                    cloudWatchMetricsEnabled: true,
                    metricName: naming.waf.rules.allowDatadogIps,
                    sampledRequestsEnabled: false,
                }
            },
            {
                name: naming.waf.rules.allowNatGatewayIps,
                priority: this.priorityDefaultRules++,
                action: { allow: {} },
                statement: {
                    labelMatchStatement: {
                        scope: 'LABEL',
                        key: 'trusted-ip:nat-gateway-ips',
                    },
                },
                visibilityConfig: {
                    cloudWatchMetricsEnabled: true,
                    metricName: naming.waf.rules.allowNatGatewayIps,
                    sampledRequestsEnabled: false,
                }
            },
            {
                name: naming.waf.rules.awsManagedRulesCommonRuleSetSelectiveBlock,
                priority: this.priorityDefaultRules++,
                action: { block: {} },
                statement: {
                    andStatement: {
                        statements: [
                            {
                                labelMatchStatement: {
                                    scope: 'NAMESPACE',
                                    key: 'awswaf:managed:aws:core-rule-set:',
                                },
                            },
                            {
                                notStatement: {
                                    statement: {
                                        labelMatchStatement: {
                                            scope: 'LABEL',
                                            key: 'known-false-positives:mcs-logo',
                                        },
                                    },
                                },
                            },
                            {
                                notStatement: {
                                    statement: {
                                        labelMatchStatement: {
                                            scope: 'LABEL',
                                            key: 'known-false-positives:mcs-file',
                                        },
                                    },
                                },
                            },
                            {
                                notStatement: {
                                    statement: {
                                        labelMatchStatement: {
                                            scope: 'LABEL',
                                            key: 'known-false-positives:mcs-ges-import-batchtemplates',
                                        },
                                    },
                                },
                            },
                            {
                                notStatement: {
                                    statement: {
                                        labelMatchStatement: {
                                            scope: 'LABEL',
                                            key: 'known-false-positives:mcs-question',
                                        },
                                    },
                                },
                            },
                            {
                                notStatement: {
                                    statement: {
                                        labelMatchStatement: {
                                            scope: 'LABEL',
                                            key: 'known-false-positives:mcs-admin-question',
                                        },
                                    },
                                },
                            },
                        ],
                    },
                },
                visibilityConfig: {
                    cloudWatchMetricsEnabled: true,
                    metricName: naming.waf.rules.awsManagedRulesCommonRuleSetSelectiveBlock,
                    sampledRequestsEnabled: true,
                },
            },
            {
                name: naming.waf.rules.geoBlocking,
                priority: ++this.priorityAfterShieldAdvanced,
                action: { block: {}, },
                statement: {
                    notStatement: {
                        statement: {
                            geoMatchStatement: { countryCodes: ['BE', 'FI', 'NL', 'NO', 'PL', 'ES', 'SE',], },
                        },
                    },
                },
                visibilityConfig: {
                    cloudWatchMetricsEnabled: true,
                    metricName: naming.waf.rules.geoBlocking,
                    sampledRequestsEnabled: false,
                },
            }
        ]
    }
}