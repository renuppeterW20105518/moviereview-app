#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
//import { MoviereviewAppStack } from '../lib/moviereview-app-stack';
import { AuthAppStack } from '../lib/auth-app-stack';

const app = new cdk.App();
//new MoviereviewAppStack(app, 'MoviereviewAppStack', { });
 
//const appAuth = new cdk.App();
new AuthAppStack(app, 'AuthAPIStack', { });
