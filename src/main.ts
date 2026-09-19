import * as dotenv from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CodeReviewOrchestrator } from './orchestrator';
import { ReportGenerator } from './utils/report-generator';
import {
 formatError,
 isReviewError,
 ReviewError,
 ErrorCodes,
 withRetry,
 withTimeout,
} from './utils/error-handler';

import {
  globalRateLimiter,
  withRateLimit,
} from './utils/rate-limiter';
// Load environment variables from .env
dotenv.config();
/**
* Main entry point for the Claude Multi-Agent Code Review System
*
* Usage:
* npm run dev -- <owner> <repo> <pr-number>
*/
async function main(): Promise<void> {
 const [, , owner, repo, prStr] = process.argv;
 // ---------------------------------------------------------
 // 1. Validate command-line arguments
 // ---------------------------------------------------------
 if (!owner || !repo || !prStr) {
 console.error(
 'Usage: npm run dev -- <owner> <repo> <pr-number>'
 );
 process.exitCode = 1;
 return;
 }
 const prNumber = Number(prStr);
 if (!Number.isInteger(prNumber) || prNumber <= 0) {
 console.error(
 `Invalid pull request number: "${prStr}". It must be a positive integer.`
 );
 process.exitCode = 1;
 return;
 }
 // ---------------------------------------------------------
 // 2. Validate authentication
 // ---------------------------------------------------------
 const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
 const awsAccessKey = process.env.AWS_ACCESS_KEY_ID;
 const awsSecretKey = process.env.AWS_SECRET_ACCESS_KEY;
 const usingAnthropicApi = Boolean(anthropicApiKey);
 const usingAwsBedrock = Boolean(awsAccessKey && awsSecretKey);
 if (!usingAnthropicApi && !usingAwsBedrock) {
 console.error(
 'Authentication is not configured.\n' +
 'Set either ANTHROPIC_API_KEY for Anthropic API authentication,\n' +
 'or AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY for AWS Bedrock.'
 );
 process.exitCode = 1;
 return;
 }
 if (usingAwsBedrock && !process.env.AWS_REGION) {
 console.error(
 'AWS_REGION must be set when using AWS Bedrock authentication.'
 );
 process.exitCode = 1;
 return;
 }
 // ---------------------------------------------------------
 // 3. Validate Anthropic model
 // ---------------------------------------------------------
 const model = process.env.ANTHROPIC_MODEL;
 if (!model) {
 console.error(
 'ANTHROPIC_MODEL is not configured in the .env file.'
 );
 process.exitCode = 1;
 return;
 }
 console.log(`Starting code review for ${owner}/${repo}#${prNumber}`);
 console.log(`Using model: ${model}`);
 const startTime = Date.now();
 try {
 // -------------------------------------------------------
 // 4. Create orchestrator
 // -------------------------------------------------------
 const orchestrator = new CodeReviewOrchestrator({
 model,
 });
 // -------------------------------------------------------
 // 5. Run the review with retry + timeout protection
 // -------------------------------------------------------
 const report = await withRetry(
  () =>
    withRateLimit(
      globalRateLimiter,
      () =>
        withTimeout(
          () =>
            orchestrator.reviewPullRequest(
              owner,
              repo,
              prNumber
            ),
          10 * 60 * 1000,
          'Code review timed out'
        ),
      1000
    ),
  3,
  2000
);
 // -------------------------------------------------------
 // 6. Generate reports
 // -------------------------------------------------------
 const reportGenerator = new ReportGenerator();
 const markdownReport =
 reportGenerator.generateMarkdownReport(report);
 const htmlReport =
 reportGenerator.generateHTMLReport(report);
 const jsonReport =
 reportGenerator.generateJSONReport(report);
 // -------------------------------------------------------
 // 7. Create reports directory
 // -------------------------------------------------------
 const reportsDirectory = join(process.cwd(), 'reports');
 await mkdir(reportsDirectory, {
 recursive: true,
 });
 // -------------------------------------------------------
 // 8. Save JSON, Markdown and HTML reports
 // -------------------------------------------------------
 const baseName = `${owner}-${repo}-pr-${prNumber}`;
 const jsonPath = join(
 reportsDirectory,
 `${baseName}.json`
 );
 const markdownPath = join(
 reportsDirectory,
 `${baseName}.md`
 );
 const htmlPath = join(
 reportsDirectory,
 `${baseName}.html`
 );
 await writeFile(jsonPath, jsonReport, 'utf8');
 await writeFile(markdownPath, markdownReport, 'utf8');
 await writeFile(htmlPath, htmlReport, 'utf8');
 // -------------------------------------------------------
 // 9. Display completion informationc
 // -------------------------------------------------------
 const duration = Date.now() - startTime;
 console.log('\nCode review completed successfully.');
 console.log(`Duration: ${duration} ms`);
 console.log(`Overall score: ${report.summary.overallScore}`);
 console.log(`Files reviewed: ${report.summary.totalFiles}`);
 console.log('\nReports generated:');
 console.log(` JSON: ${jsonPath}`);
 console.log(` Markdown: ${markdownPath}`);
 console.log(` HTML: ${htmlPath}`);
 } catch (error: unknown) {
 if (isReviewError(error)) {
 console.error(`\nReview failed: ${formatError(error)}`);
 console.error(`Error code: ${error.code}`);
 console.error('Metadata:', error.metadata);
 } else if (error instanceof Error) {
 console.error(`\nReview failed: ${error.message}`);
 } else {
 console.error('\nReview failed:', error);
 }
 process.exitCode = 1;
 }
}
main().catch((error: unknown) => {
 console.error('Unexpected error:', formatError(error));
 process.exitCode = 1;
});