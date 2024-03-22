import { Aws } from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apig from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as node from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambdanode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as custom from "aws-cdk-lib/custom-resources";
import { generateBatch } from "../shared/util";
import {moviereviews} from "../seed/moviereviews";
import * as iam from "aws-cdk-lib/aws-iam";

type AppApiProps = {
  userPoolId: string;
  userPoolClientId: string;
};

export class AppApi extends Construct {
  constructor(scope: Construct, id: string, props: AppApiProps) {
    super(scope, id);

    const appApi = new apig.RestApi(this, "AppApi", {
      description: "App RestApi",
      endpointTypes: [apig.EndpointType.REGIONAL],
      defaultCorsPreflightOptions: {
        allowOrigins: apig.Cors.ALL_ORIGINS,
      },
    });

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

    //#endRegion

    const appCommonFnProps = {
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: "handler",
      environment: {
        USER_POOL_ID: props.userPoolId,
        CLIENT_ID: props.userPoolClientId,
        REGION: cdk.Aws.REGION,
      },
    };

    const moviesEndpoint = appApi.root.addResource("movies");
    const movieIdEndpoint = moviesEndpoint.addResource("{movieId}");
    const reviewsContent = movieIdEndpoint.addResource("reviews");
    const reviewerEndpoint = reviewsContent.addResource("{reviewerName}")
    const addmovieReviewEndpoint = moviesEndpoint.addResource("reviews")

    const reviewEndpoint = appApi.root.addResource("reviews");
    const reviewreviewerNameEndpoint = reviewEndpoint.addResource("{reviewerName}");

    //GET /reviews/{reviewerName}/{movieId}/translation?language=code
    const langMovieIdEndpoint = reviewreviewerNameEndpoint.addResource("{movieId}").addResource("translation")

    const getMovieReviewByIdFn = new node.NodejsFunction(this,"GetMovieReviewByIdFn",{
          ...appCommonFnProps,
          entry: `${__dirname}/../lambdas/getMovieReviewById.ts`,
        }
      );

      const newMovieReviewFn = new node.NodejsFunction(this, "AddMovieReviewFn", {
        ...appCommonFnProps,
        entry: `${__dirname}/../lambdas/postMovieReview.ts`,
      });
  
      const getMovieReviewByRatingFn = new node.NodejsFunction(this,"GetMovieReviewByRatingFn",{
          ...appCommonFnProps,
          entry: `${__dirname}/../lambdas/getMovieReviewByRating.ts`,
        }
      );
  
      const getMovieReviewByReviewerFn = new node.NodejsFunction(this,"GetMovieReviewByReviewerFn",{
          ...appCommonFnProps,
          entry: `${__dirname}/../lambdas/getMovieReviewByReviewer.ts`,
        }
      );
  
      const putMovieReviewByReviewerFn = new node.NodejsFunction(this,"PutMovieReviewByReviewerFn",{
          ...appCommonFnProps,
          entry: `${__dirname}/../lambdas/putMovieReviewByReviewerFn.ts`,
        }
      );
  
      const getReviewReviewerNameFn = new node.NodejsFunction(this,"GetReviewReviewerNameFn",{
          ...appCommonFnProps,
          entry: `${__dirname}/../lambdas/getReviewReviewerName.ts`,
        }
      );
  
      const languageFn = new node.NodejsFunction(this,"LanguageFn",{
          ...appCommonFnProps,
          entry: `${__dirname}/../lambdas/languagetranslation.ts`,
        }
      );

  languageFn.role?.attachInlinePolicy(new iam.Policy(this, 'TranslateTextPolicy', {
      statements: [
        new iam.PolicyStatement({
          actions: ['translate:TranslateText'],
          resources: ['*'], // Consider restricting to specific resources if possible
        }),
      ],
    }));

    const authorizerFn = new node.NodejsFunction(this, "AuthorizerFn", {
      ...appCommonFnProps,
      entry: `${__dirname}/../lambdas/auth/authorizer.ts`,
    });

    const requestAuthorizer = new apig.RequestAuthorizer(
      this,
      "RequestAuthorizer",
      {
        identitySources: [apig.IdentitySource.header("cookie")],
        handler: authorizerFn,
        resultsCacheTtl: cdk.Duration.minutes(0),
      }
    );

    // Permissions 
    movieReviewsTable.grantReadData(getMovieReviewByIdFn)
    movieReviewsTable.grantReadWriteData(newMovieReviewFn)
    movieReviewsTable.grantReadData(getMovieReviewByRatingFn)
    movieReviewsTable.grantReadData(getMovieReviewByReviewerFn)
    movieReviewsTable.grantReadWriteData(putMovieReviewByReviewerFn)
    movieReviewsTable.grantReadData(getReviewReviewerNameFn)

    //GET /movies/{movieId}/reviews
    reviewsContent.addMethod("GET", new apig.LambdaIntegration(getMovieReviewByIdFn, { proxy: true }));

    //POST /movies/reviews
    addmovieReviewEndpoint.addMethod("POST", new apig.LambdaIntegration(newMovieReviewFn, { proxy: true }),{
          authorizer: requestAuthorizer,
          authorizationType: apig.AuthorizationType.CUSTOM,
        });

     //GET /movies/{movieId}/reviews/{reviewerName}
    reviewerEndpoint.addMethod("GET", new apig.LambdaIntegration(getMovieReviewByReviewerFn, { proxy: true }));
  
      //PUT /movies/{movieId}/reviews/{reviewerName}
      reviewerEndpoint.addMethod("PUT", new apig.LambdaIntegration(putMovieReviewByReviewerFn, { proxy: true }),{
          authorizer: requestAuthorizer,
          authorizationType: apig.AuthorizationType.CUSTOM,
        });
  
      //GET /reviews/{reviewerName}
      reviewreviewerNameEndpoint.addMethod("GET", new apig.LambdaIntegration(getReviewReviewerNameFn, { proxy: true }));
  
      langMovieIdEndpoint.addMethod("GET", new apig.LambdaIntegration(languageFn, { proxy: true }));
  }
}