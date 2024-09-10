const path = require('path');

module.exports = {
	entry: "./src/main.ts",
	resolve: {
		modules: [path.resolve(__dirname, './src')]
	},
	mode: "production",
    module: {
		rules: [
			{ test: /\.ts$/, use: 'ts-loader' },
		],
    },
    output: {
        filename: '.js',
        path: path.resolve(__dirname, './')
    },
    resolve: {
        extensions: ['.ts','.js']
    },
};
