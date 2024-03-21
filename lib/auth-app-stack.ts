import * as cdk from "aws-cdk-lib";
import { Aws } from "aws-cdk-lib";
import { Construct } from "constructs";
import { UserPool } from "aws-cdk-lib/aws-cognito";
import * as apig from "aws-cdk-lib/aws-apigateway";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as node from "aws-cdk-lib/aws-lambda-nodejs";
export class AuthAppStack extends cdk.Stack {
  private auth: apig.IResource;
  private userPoolId: string;
  private userPoolClientId: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const userPool = new UserPool(this, "UserPool", {
      signInAliases: { username: true, email: true },
      selfSignUpEnabled: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.userPoolId = userPool.userPoolId;

    const appClient = userPool.addClient("AppClient", {
      authFlows: { userPassword: true },
    });

    this.userPoolClientId = appClient.userPoolClientId;

    const authApi = new apig.RestApi(this, "AuthServiceApi", {
      description: "Authentication Service RestApi",
      endpointTypes: [apig.EndpointType.REGIONAL],
      defaultCorsPreflightOptions: {
        allowOrigins: apig.Cors.ALL_ORIGINS,
      },
    });

    this.auth = authApi.root.addResource("auth");

    this.addAuthRoute(
      "signup",
      "POST",
      "SignupFn",
      'signup.ts'
    );

    this.addAuthRoute(
      "confirm_signup",
      "POST",
      "ConfirmFn",
      "confirm-signup.ts"
    );

    this.addAuthRoute('signout', 'GET', 'SignoutFn', 'signout.ts');
    this.addAuthRoute('signin', 'POST', 'SigninFn', 'signin.ts');

    // NEW
    const appApi = new apig.RestApi(this, "AppApi", {
      description: "App RestApi",
      endpointTypes: [apig.EndpointType.REGIONAL],
      defaultCorsPreflightOptions: {
        allowOrigins: apig.Cors.ALL_ORIGINS,
      },
    });

    const appCommonFnProps = {
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "handler",
      environment: {
        USER_POOL_ID: this.userPoolId,
        CLIENT_ID: this.userPoolClientId,
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
   
    const getMovieReviewByIdFn = new node.NodejsFunction(
      this,
      "GetMovieReviewByIdFn",
      {
        ...appCommonFnProps,
        entry: `${__dirname}/../lambdas/getMovieReviewById.ts`,
      }
    );

    const newMovieReviewFn = new node.NodejsFunction
    (this, "AddMovieReviewFn", 
    {
      ...appCommonFnProps,
      entry: `${__dirname}/../lambdas/postMovieReview.ts`,
    });

    const getMovieReviewByRatingFn = new node.NodejsFunction(
      this,
      "GetMovieReviewByRatingFn",
      {
        ...appCommonFnProps,
        entry: `${__dirname}/../lambdas/getMovieReviewByRating.ts`,
      }
    );

    const getMovieReviewByReviewerFn = new node.NodejsFunction(
      this,
      "GetMovieReviewByReviewerFn",
      {
        ...appCommonFnProps,
        entry: `${__dirname}/../lambdas/getMovieReviewByReviewer.ts`,
      }
    );

    const putMovieReviewByReviewerFn = new node.NodejsFunction(
      this,
      "PutMovieReviewByReviewerFn",
      {
        ...appCommonFnProps,
        entry: `${__dirname}/../lambdas/putMovieReviewByReviewerFn.ts`,
      }
    );

    const getReviewReviewerNameFn = new node.NodejsFunction(
      this,
      "GetReviewReviewerNameFn",
      {
        ...appCommonFnProps,
        entry: `${__dirname}/../lambdas/getReviewReviewerName.ts`,
      }
    );

    const languageFn = new node.NodejsFunction(
      this,
      "LanguageFn",
      {
        ...appCommonFnProps,
        entry: `${__dirname}/../lambdas/languagetranslation.ts`,
      }
    );


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

    //GET /movies/{movieId}/reviews
     reviewsContent.addMethod(
      "GET",
      new apig.LambdaIntegration(getMovieReviewByIdFn, { proxy: true })
    );

    //POST /movies/reviews
    addmovieReviewEndpoint.addMethod(
      "POST",
      new apig.LambdaIntegration(newMovieReviewFn, { proxy: true }),{
        authorizer: requestAuthorizer,
        authorizationType: apig.AuthorizationType.CUSTOM,
      });

    //GET /movies/{movieId}/reviews/{reviewerName}
    reviewerEndpoint.addMethod(
      "GET",
      new apig.LambdaIntegration(getMovieReviewByReviewerFn, { proxy: true })
    );

    //PUT /movies/{movieId}/reviews/{reviewerName}
    reviewerEndpoint.addMethod(
      "PUT",
      new apig.LambdaIntegration(putMovieReviewByReviewerFn, { proxy: true }),{
        authorizer: requestAuthorizer,
        authorizationType: apig.AuthorizationType.CUSTOM,
      });

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

  private addAuthRoute(
    resourceName: string,
    method: string,
    fnName: string,
    fnEntry: string,
    allowCognitoAccess?: boolean
  ): void {
    const commonFnProps = {
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "handler",
      environment: {
        USER_POOL_ID: this.userPoolId,
        CLIENT_ID: this.userPoolClientId,
        REGION: cdk.Aws.REGION
      },
    };
    
    const resource = this.auth.addResource(resourceName);
    
    const fn = new node.NodejsFunction(this, fnName, {
      ...commonFnProps,
      entry: `${__dirname}/../lambdas/auth/${fnEntry}`,
    });

    resource.addMethod(method, new apig.LambdaIntegration(fn));
  } 

}
