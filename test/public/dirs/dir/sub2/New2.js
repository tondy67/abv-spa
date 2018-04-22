/** 
 * Cache
 */
"use strict";

const ts = require('abv-ts')('abv:spa');

// Това е тест за кирилица
// Тази функция не прави нищо, но пък за сметка на това стои добре :)))
const fun = () => {
	for (let i=0; i < 5; i++) ts.println('Hello world :)');
};

module.exports = fun;
