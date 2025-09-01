import * as cdk from "aws-cdk-lib";
import { Construct } from 'constructs';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as naming from "../../bin/naming";
import * as data from "../../bin/data";
import * as shield from 'aws-cdk-lib/aws-shield';
import { SsmParameterStoreReader } from "../utils/ssm-parameter-store-reader";
import { S3Stack } from "../storage/s3-logs-stack";
import { ComputeStack } from "../compute/service-stack";


export const APP_CUSTOM_HEADER_NAME = 'secret-app-key';


export class CloudFrontStack extends cdk.Stack {

    private readonly originAccessControl: cloudfront.CfnOriginAccessControl;
    private readonly distribution: cloudfront.CfnDistribution;

    constructor(scope: Construct, id: string, props: cdk.StackProps, s3Stack: S3Stack, computeStack: ComputeStack) {
        super(scope, id, props);
        
        this.originAccessControl = this.createOriginAccessControl();
        this.distribution = this.createCloudFrontDistribution(computeStack);
        this.enableShieldAdvancedForCloudFront();
    }

    private createOriginAccessControl(): cloudfront.CfnOriginAccessControl {
        return new cloudfront.CfnOriginAccessControl(this, "OAC", {
            originAccessControlConfig: {
                name: naming.cdn.oac,
                description: `Origin Access Control for ${naming.cdn.distribution}`,
                originAccessControlOriginType: "s3",
                signingBehavior: "always",
                signingProtocol: "sigv4",
            },
        });
    }

    private createCloudFrontDistribution(computeStack: ComputeStack): cloudfront.CfnDistribution {
        const loggingProperties: cloudfront.CfnDistribution.LoggingProperty = {
            bucket: `cloudfront-logs-${this.account}-${this.region}.s3.amazonaws.com`,
            includeCookies: true,
            prefix: `${data.cloudfrontDomains[data.env][0]}/`,
        };

        const certificateProperties: cloudfront.CfnDistribution.ViewerCertificateProperty = {
            acmCertificateArn: data.cloudfrontCertificateArn,
            minimumProtocolVersion: "TLSv1.2_2021",
            sslSupportMethod: "sni-only",
        };

        const albOrigin: cloudfront.CfnDistribution.OriginProperty = {
            id: 'Services',
            domainName: computeStack.alb.loadBalancerDnsName,
            customOriginConfig: {
                originSslProtocols: ['TLSv1.2'],
                originProtocolPolicy: 'https-only',
            },
            originCustomHeaders: [
                {
                    headerName: APP_CUSTOM_HEADER_NAME,
                    headerValue: data.cloudfrontCustomHeaderValue,
                }
            ],
        };

        const responseHeadersPolicy = new cloudfront.CfnResponseHeadersPolicy(this, 'CloudFrontHeaderResponsePolicy', {
            responseHeadersPolicyConfig: {
                name: naming.cdn.responsePolicy,
                comment: `Response headers policy - CORS & Security Headers`,
                // corsConfig: {
                //     originOverride: true,
                //     accessControlAllowCredentials: false,
                //     accessControlAllowHeaders: {
                //         items: ['*'],
                //     },
                //     accessControlAllowMethods: {
                //         items: ['GET', 'HEAD', 'DELETE', 'POST', 'PUT', 'OPTIONS', 'PATCH'],
                //     },
                //     accessControlAllowOrigins: {
                //         items: [
                //             ...data.cloudfrontDomains[data.env],
                //             ...data.AccessControlDomains[data.env],
                //         ],
                //     },
                // },
                securityHeadersConfig: {
                    strictTransportSecurity: {
                        accessControlMaxAgeSec: 31536000,
                        includeSubdomains: true,
                        preload: true,
                        override: true,
                    },
                    contentTypeOptions: {
                        override: true,
                    },
                    frameOptions: {
                        frameOption: 'SAMEORIGIN',
                        override: true,
                    },
                    xssProtection: {
                        protection: true,
                        modeBlock: true,
                        override: true,
                    },
                    // contentSecurityPolicy: {
                    //      contentSecurityPolicy: "default-src 'self'; style-src 'self' https://fonts.googleapis.com https://use.fontawesome.com https://www.wiris.net https://cdn.tiny.cloud https://unpkg.com/mathlive/dist/mathlive.core.css https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css 'unsafe-inline'; font-src 'self' https://use.fontawesome.com https://fonts.gstatic.com https://cdn.jsdelivr.net; script-src 'self' 'unsafe-inline' https://www.wiris.net https://cdn.tiny.cloud https://unpkg.com/mathlive https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js; connect-src 'self' https://dev-evalactividades.santillana.es https://cdn.tiny.cloud https://www.wiris.net https://unpkg.com/mathlive; img-src 'self' https://dev-evalactividades.santillana.es https://sp.tinymce.com https://www.wiris.net data: blob:; form-action 'self'; upgrade-insecure-requests;",
                    //      override: true,
                    //  },
                    // referrerPolicy: {
                    //     referrerPolicy: 'strict-origin-when-cross-origin',
                    //     override: true,
                    // },
                },
                removeHeadersConfig: { items: [{ header: 'X-Powered-By' }, { header: 'Server' }], },
            },
        });

        const wafWebAclParameter: SsmParameterStoreReader = new SsmParameterStoreReader(this, 'SsmReaderWafWebAcl', {
            parameterName: `/cdk/output/${data.project}/${data.env}/app-waf-web-acl-arn`,
            region: 'us-east-1'
        });

        const cloudfrontFunctionUrlRewriteSpaPath = `/cdk/output/cloudfront-function-url-rewrite-arn`;
        const cloudfrontFunctionUrlRewriteSpaArn = ssm.StringParameter.valueForStringParameter(this, cloudfrontFunctionUrlRewriteSpaPath);

        return new cloudfront.CfnDistribution(this, "CloudfrontDist", {
            distributionConfig: {
                enabled: true,
                comment: naming.cdn.distribution,
                aliases: data.cloudfrontDomains[data.env],
                defaultRootObject: 'index.html',
                httpVersion: 'http2and3',
                ipv6Enabled: true,
                priceClass: 'PriceClass_100',
                logging: loggingProperties,
                viewerCertificate: certificateProperties,
                origins: [albOrigin], 
                webAclId: wafWebAclParameter.value,
                defaultCacheBehavior: {
                    targetOriginId: 'Services',
                    allowedMethods: ['GET', 'HEAD', 'OPTIONS'],
                    compress: true,
                    viewerProtocolPolicy: 'redirect-to-https',
                    cachePolicyId: '658327ea-f89d-4fab-a63d-7e88639e58f6',
                    originRequestPolicyId: '88a5eaf4-2fd4-4709-b370-b4c650ea3fcf',
                    responseHeadersPolicyId: responseHeadersPolicy.attrId,
                    functionAssociations: [
                        {
                            eventType: 'viewer-request',
                            functionArn: cloudfrontFunctionUrlRewriteSpaArn,
                        }
                    ]
                },
                cacheBehaviors: [
                    {
                        targetOriginId: 'Services',
                        pathPattern: '/mcs/*',
                        viewerProtocolPolicy: 'redirect-to-https',
                        allowedMethods: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'POST', 'PATCH', 'DELETE'],
                        compress: false,
                        cachePolicyId: '4135ea2d-6df8-44a3-9df3-4b5a84be39ad',
                        originRequestPolicyId: '216adef6-5c7f-47e4-b989-5492eafa07d3',
                        responseHeadersPolicyId: responseHeadersPolicy.attrId,
                    },
                    {
                        targetOriginId: 'Files',
                        pathPattern: '/evlfiles/*',
                        allowedMethods: ['GET', 'HEAD', 'OPTIONS'],
                        compress: true,
                        viewerProtocolPolicy: 'redirect-to-https',
                        cachePolicyId: '658327ea-f89d-4fab-a63d-7e88639e58f6',
                        originRequestPolicyId: '88a5eaf4-2fd4-4709-b370-b4c650ea3fcf',
                        responseHeadersPolicyId: responseHeadersPolicy.attrId,
                    }
                ],
            }
        });
    }

    private enableShieldAdvancedForCloudFront(): void {
        new shield.CfnProtection(this, 'ShieldAdvancedForCloudFront', {
            name: naming.waf.shield,
            resourceArn: `arn:aws:cloudfront::${this.account}:distribution/${this.distribution.attrId}`,
            applicationLayerAutomaticResponseConfiguration: {
                action: { block: {} },
                status: 'ENABLED',
            }
        });
    }
}