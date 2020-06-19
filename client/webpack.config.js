const parentConfigFactory = require('../webpack.config');
const path = require('path');

module.exports = (env) => {
  const parentConfig = parentConfigFactory(env);
  
  return {
    ...parentConfig,
    output: {
      ...parentConfig.output,
      library: 'avcoreClient',
      path: path.resolve(__dirname, 'dist'),
    },
  };
};
