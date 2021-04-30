var allTests = require.context('.', true, /Spec\.js$/);

allTests.keys().forEach(allTests);

var allSources = require.context('../client', true, /.*\.js$/);

allSources.keys().forEach(allSources);