import * as cdk from 'aws-cdk-lib';
import * as lambdanode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

import * as custom from "aws-cdk-lib/custom-resources";
import { generateBatch } from "../shared/util";
import {moviereviews} from "../seed/moviereviews";

import { Construct } from 'constructs';

export class MoviereviewAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const reviewFn = new lambdanode.NodejsFunction(this, "ReviewFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_16_X,
      entry: `${__dirname}/../lambdas/review.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
    });

    const reviewFnURL = reviewFn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.AWS_IAM,
      cors: {
        allowedOrigins: ["*"],
      },
    });

    const movieReviewsTable = new dynamodb.Table(this, "MovieReviewsTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "movie_id", type: dynamodb.AttributeType.NUMBER },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "MovieReviews",
    });

    new custom.AwsCustomResource(this, "moviereviewsddbInitData", {
      onCreate: {
        service: "DynamoDB",
        action: "batchWriteItem",
        parameters: {
          RequestItems: {
            [movieReviewsTable.tableName]: generateBatch(moviereviews),
          },
        },
        physicalResourceId: custom.PhysicalResourceId.of("moviereviewsddbInitData"), 
      },
      policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [movieReviewsTable.tableArn],
      }),
    });

    new cdk.CfnOutput(this, "Review Function Url", { value: reviewFnURL.url });
    

  }
}
