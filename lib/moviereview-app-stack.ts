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
      sortKey: {name: "Rating", type: dynamodb.AttributeType.NUMBER},
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "MovieReviews",
    });

    movieReviewsTable.addLocalSecondaryIndex({
      indexName: "reviewerIndex",
      sortKey: { name: "ReviewerName", type: dynamodb.AttributeType.STRING },
    });

    movieReviewsTable.addLocalSecondaryIndex({
      indexName: "reviewDateIndex",
      sortKey: { name: "ReviewDate", type: dynamodb.AttributeType.STRING },
    });

    //#endregion

    //#region [Functions]

    const apiCommonFn = {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_18_X,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        TABLE_NAME: movieReviewsTable.tableName,
        REGION: 'eu-west-1',
      },
      handler: "handler", 
    }

    const getMovieReviewByIdFn = new lambdanode.NodejsFunction(
      this,
      "GetMovieReviewByIdFn",
      {
        ...apiCommonFn,
        entry: `${__dirname}/../lambdas/getMovieReviewById.ts`,
      }
    );

    const newMovieReviewFn = new lambdanode.NodejsFunction
    (this, "AddMovieReviewFn", 
    {
      ...apiCommonFn,
      entry: `${__dirname}/../lambdas/postMovieReview.ts`,
    });

    const getMovieReviewByRatingFn = new lambdanode.NodejsFunction(
      this,
      "GetMovieReviewByRatingFn",
      {
        ...apiCommonFn,
        entry: `${__dirname}/../lambdas/getMovieReviewByRating.ts`,
      }
    );

    const getMovieReviewByReviewerFn = new lambdanode.NodejsFunction(
      this,
      "GetMovieReviewByReviewerFn",
      {
        ...apiCommonFn,
        entry: `${__dirname}/../lambdas/getMovieReviewByReviewer.ts`,
      }
    );

    const putMovieReviewByReviewerFn = new lambdanode.NodejsFunction(
      this,
      "PutMovieReviewByReviewerFn",
      {
        ...apiCommonFn,
        entry: `${__dirname}/../lambdas/putMovieReviewByReviewerFn.ts`,
      }
    );

    const getReviewReviewerNameFn = new lambdanode.NodejsFunction(
      this,
      "GetReviewReviewerNameFn",
      {
        ...apiCommonFn,
        entry: `${__dirname}/../lambdas/getReviewReviewerName.ts`,
      }
    );

    const languageFn = new lambdanode.NodejsFunction(
      this,
      "LanguageFn",
      {
        ...apiCommonFn,
        entry: `${__dirname}/../lambdas/languagetranslation.ts`,
      }
    );

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
    movieReviewsTable.grantReadData(getMovieReviewByRatingFn)
    movieReviewsTable.grantReadData(getMovieReviewByReviewerFn)
    movieReviewsTable.grantReadWriteData(putMovieReviewByReviewerFn)
    movieReviewsTable.grantReadData(getReviewReviewerNameFn)

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
    const movieIdEndpoint = moviesEndpoint.addResource("{movieId}");
    const reviewsContent = movieIdEndpoint.addResource("reviews");
    const reviewerEndpoint = reviewsContent.addResource("{reviewerName}")
    const addmovieReviewEndpoint = moviesEndpoint.addResource("reviews")

    const reviewEndpoint = api.root.addResource("reviews");
    const reviewreviewerNameEndpoint = reviewEndpoint.addResource("{reviewerName}");

    //GET /reviews/{reviewerName}/{movieId}/translation?language=code
    const langMovieIdEndpoint = reviewreviewerNameEndpoint.addResource("{movieId}").addResource("translation")


    //GET /movies/{movieId}/reviews
    reviewsContent.addMethod(
      "GET",
      new apig.LambdaIntegration(getMovieReviewByIdFn, { proxy: true })
    );

    //POST /movies/reviews
    addmovieReviewEndpoint.addMethod(
      "POST",
      new apig.LambdaIntegration(newMovieReviewFn, { proxy: true })
    );

    //GET /movies/{movieId}/reviews/{reviewerName}
    reviewerEndpoint.addMethod(
      "GET",
      new apig.LambdaIntegration(getMovieReviewByReviewerFn, { proxy: true })
    );

    //PUT /movies/{movieId}/reviews/{reviewerName}
    reviewerEndpoint.addMethod(
      "PUT",
      new apig.LambdaIntegration(putMovieReviewByReviewerFn, { proxy: true })
    );

    //GET /reviews/{reviewerName}
    reviewreviewerNameEndpoint.addMethod(
      "GET",
      new apig.LambdaIntegration(getReviewReviewerNameFn, { proxy: true })
    );

    langMovieIdEndpoint.addMethod(
      "GET",
      new apig.LambdaIntegration(languageFn, { proxy: true })
    );

  }
}
