import * as cdk from 'aws-cdk-lib';
import * as lambdanode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

import * as custom from "aws-cdk-lib/custom-resources";
import { generateBatch } from "../shared/util";
import {moviereviews} from "../seed/moviereviews";
import * as apig from "aws-cdk-lib/aws-apigateway";

import { Construct } from 'constructs';

export class MoviereviewAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    //#region [Tables]

    const movieReviewsTable = new dynamodb.Table(this, "MovieReviewsTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "MovieId", type: dynamodb.AttributeType.NUMBER },
      sortKey: {name: "ReviewerName", type: dynamodb.AttributeType.STRING},
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "MovieReviews",
    });

  //   movieReviewsTable.addGlobalSecondaryIndex({
  //     indexName: 'RatingIndex',
  //     partitionKey: { name: 'Rating', type: dynamodb.AttributeType.NUMBER },
  //     projectionType: dynamodb.ProjectionType.ALL // Include all attributes in the index
  // });

    //#endregion

    //#region [Functions]

    const getMovieReviewByIdFn = new lambdanode.NodejsFunction(
      this,
      "GetMovieReviewByIdFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/getMovieReviewById.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: movieReviewsTable.tableName,
          REGION: 'eu-west-1',
        },
      }
    );

    const newMovieReviewFn = new lambdanode.NodejsFunction(this, "AddMovieReviewFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: `${__dirname}/../lambdas/postMovieReview.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        TABLE_NAME: movieReviewsTable.tableName,
        REGION: "eu-west-1",
      },
    });

    //#endregion


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

    // Permissions 
    movieReviewsTable.grantReadData(getMovieReviewByIdFn)
    movieReviewsTable.grantReadWriteData(newMovieReviewFn)

    const api = new apig.RestApi(this, "MoviereviewApp", {
      description: "Movie Review api",
      deployOptions: {
        stageName: "dev",
      },
      defaultCorsPreflightOptions: {
        allowHeaders: ["Content-Type", "X-Amz-Date"],
        allowMethods: ["OPTIONS", "GET", "POST", "PUT", "PATCH", "DELETE"],
        allowCredentials: true,
        allowOrigins: ["*"],
      },
    });

    const moviesEndpoint = api.root.addResource("movies");
    const movieEndpoint = moviesEndpoint.addResource("{movieId}");
    const reviewsContent = movieEndpoint.addResource("reviews");
    const addmovieReviewEndpoint = moviesEndpoint.addResource("reviews")
    
    reviewsContent.addMethod(
      "GET",
      new apig.LambdaIntegration(getMovieReviewByIdFn, { proxy: true })
    );

    addmovieReviewEndpoint.addMethod(
      "POST",
      new apig.LambdaIntegration(newMovieReviewFn, { proxy: true })
    );

  }
}
