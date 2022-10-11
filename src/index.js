function Manager() {

}

Manager.require = function (p, dir) {
  switch (p) {
    case 'web-manager':
      return new (require('web-manager'));
    default:

    process.chdir('/Users/ianwiedenman/Documents/GitHub/ITW-Creative-Works/ultimate-jekyll');
    __dirname = '/Users/ianwiedenman/Documents/GitHub/ITW-Creative-Works/ultimate-jekyll'
    console.log('__dirname 22222', __dirname);
      return require(p);
  }
};


// Manager.prototype.requireFromString = function(src, filename) {
//   var m = new module.constructor();
//   m.paths = module.paths;
//   // https://stackoverflow.com/questions/5409428/how-to-override-a-javascript-function
//   // m.require = (function(_super) {
//   //   return function() {
//   //     let path = arguments[0] || '';
//   //     // console.log('RESOLVED PATH', require.resolve(path));
//   //     if (_requireBlacklist.some(v => v.test(path)))  {
//   //       throw new Error(`${path} is not allowed in modules for security reasons.`)
//   //     } else {
//   //       // https://stackoverflow.com/questions/9210542/node-js-require-cache-possible-to-invalidate
//   //       delete require.cache[require.resolve(path)];
//   //       return _super.apply(this, arguments);
//   //     }
//   //   };
//   // })(m.require);
//   m._compile(src, filename);
//
//   return m.exports;
// };


module.exports = Manager;
