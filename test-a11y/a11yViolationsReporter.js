/* eslint no-console: 0 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const violatingPages = [];
const violations = [];
const logColors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  blue: '\x1b[36m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m'
};

const logOutput = testPages => {
  if (testPages.length > 0) {
    testPages.forEach(page => {
      if (page.violations.length === 0) {
        return;
      }
      violatingPages.push(page);
      page.violations.forEach(v => {
        violations.push(v);
      });
      console.log(
        `${logColors.yellow}%s${logColors.reset}`,
        `${page.violations.length} error${page.violations.length === 1 ? '' : 's'} found in: ${page.page}`
      );
      const inlineMsg = `\n${page.violations
        .map(
          (v, idx) =>
            `${idx + 1}) ${v.help} -- ${v.helpUrl.replace('?application=webdriverjs', '')} -- impact: ${v.impact}`
        )
        .join('\n')}
      `;
      console.log(inlineMsg);
      console.log('-------html violation instances-------');
      const nodesSummary = `\n${page.violations.map(v => v.nodes.map(el => el.html).join('\n')).join('\n')}`;
      console.log(nodesSummary, '\n');
    });
  } else {
    console.log(`${logColors.green}%s${logColors.reset}`, 'No A11y violations found \n');
  }
};

const violationsReporter = (testPages, reportType) => {
  switch (reportType) {
    case 'json':
      console.log(JSON.stringify(testPages, null, 2));
      break;
    case 'writefile': {
      const location = path.resolve(__dirname, 'pf_a11y_violations.json');
      fs.writeFileSync(location, JSON.stringify(testPages, null, 2));
      console.log(`${logColors.yellow}%s${logColors.reset}`, `Raw audit data available at: ${location}\n`);
      break;
    }
    case 'comment-pr': {
      const prSha = process.env.TRAVIS_PULL_REQUEST_SHA;
      const repoSlug = process.env.TRAVIS_REPO_SLUG;
      const githubToken = process.env.GH_TOKEN;
      const buildId = process.env.TRAVIS_BUILD_ID;

      // console.log(`TRAVIS_REPO_SLUG: ${repoSlug}`);
      // console.log(`TRAVIS_BUILD_ID: ${process.env.TRAVIS_BUILD_ID}`);
      // console.log(`TRAVIS_COMMIT: ${prSha}`);
      // console.log(`githubToken: ${githubToken}`);

      // process.env.TRAVIS_BUILD_NUMBER

      const url = `https://api.github.com/repos/${repoSlug}/statuses/${prSha}?access_token=${githubToken}`;
      // curl -i -u seanforyou23 -d '{"state": "failure"}' https://api.github.com/repos/seanforyou23/patternfly-next/statuses/201738342551f3bfb890d94de0c684c60c06bbbd?access_token=b64db896883f50f8aaba3351b2eca129ece964f5
      // curl -i -d -u seanforyou23 '{"state": "failure"}' https://api.github.com/repos/seanforyou23/patternfly-next/statuses/064bcbeea326ab233dc504988a34356204995643?access_token=b64db896883f50f8aaba3351b2eca129ece964f5

      axios
        // query all the pages we want to run our a11y tests against
        .post(url, {
          state: 'failure',
          context: 'pf-a11y-reporter',
          description: 'There was an update to the status',
          target_url: `https://travis-ci.org/${repoSlug}/builds/${buildId}`
        })
        .then(response => {
          console.log(response);
        })
        .catch(error => {
          console.log(error);
        });

      break;
    }
    default: {
      logOutput(testPages);
    }
  }
};

module.exports = {
  pfReporter: {
    report: errors => {
      violationsReporter(errors, 'default');
      console.log(
        `${logColors.blue}%s${logColors.reset}`,
        '\n--------------PF Component Accessibility Audit--------------'
      );
      console.log(
        violatingPages.length ? logColors.red : logColors.green,
        `Found ${violatingPages.length} Page${violatingPages.length === 1 ? '' : 's'} with Accessibility Errors
        \n ${violations.length} violation${violations.length === 1 ? '' : 's'} in total`
      );
      console.log(
        `${logColors.blue}%s${logColors.reset}`,
        '------------------------------------------------------------\n'
      );
      if (!process.env.CI) {
        violationsReporter(errors, 'writefile');
      } else {
        violationsReporter(errors, 'comment-pr');
      }
      return violations;
    }
  }
};
