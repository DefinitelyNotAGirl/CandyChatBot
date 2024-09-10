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
        path: path.resolve(__dirname, './'),
		library: {
			name: 'pagelib', // you then can access it via window: `window.youLib`
			type: 'umd',
			umdNamedDefine: true,
		},
    },
    resolve: {
        extensions: ['.ts','.js','.tsx']
    },
};
