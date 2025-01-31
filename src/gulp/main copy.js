const { series, watch } = require('gulp');
const { exec } = require('child_process');
const browserSync = require('browser-sync').create();

function jekyllBuild(cb) {
  console.log('---- 1');

  exec('bundle exec jekyll build --source site', (err, stdout, stderr) => {
    if (err) {
      console.error(`Error: ${stderr}`);
      cb(err);
    } else {
      console.log(stdout);
      cb();
    }
  });
}

function serve(cb) {
  console.log('--- 2');
  browserSync.init({
    server: {
      baseDir: '_site'
    }
  });

  watch(
    ['**/*.html', '**/*.md', '**/*.yml', '**/*.scss', '**/*.js', '!_site/**'], // Ignore _site
    series(jekyllBuild, (done) => {
      console.log('--- 3');

      browserSync.notify('Rebuilt Jekyll');
      browserSync.reload();
      done();
    })
  );

  cb();
}

exports.build = series(jekyllBuild);
exports.serve = series(jekyllBuild, serve);
exports.default = series(exports.serve);
