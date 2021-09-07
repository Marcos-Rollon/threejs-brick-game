import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import css from 'rollup-plugin-css-only';



export default {
	input: 'src/main.js',
	output: {
		sourcemap: true,
		format: 'iife',
		name: 'app',
		file: 'public/build/bundle.js'
	},
	plugins: [
		// we'll extract any component CSS out into
		// a separate file - better for performance
		css({ output: 'bundle.css' }),
		resolve({
			browser: true,
		}),
		commonjs(),
	],
	watch: {
		clearScreen: false
	}
};
