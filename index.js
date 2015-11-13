/**
 * filesync
 *
 * Copyright © 2015 Jan Loose (hellpf), All rights reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

var chokidar = require('chokidar'),
    fs = require('fs'),
    path = require('path'),
    ncp = require('ncp'),
    rmdir = require('rmdir'),
    stdio = require('stdio');

var ops = stdio.getopt({
    'source': {
        key: 's',
        args: 1,
        description: 'Source directory',
        mandatory: true
    },
    'target': {
        key: 't',
        args: 1,
        description: 'Target diectory or directories (sepearated by a semicolon)',
        mandatory: true
    },
    'syncDelete': {
        key: 'd',
        args: 0,
        description: 'Sync delete changes?',
        mandatory: false
    }
});

var sourceDir = ops.source,
    targetDirs = ops.target.split(';'),
    syncDelete = ops.syncDelete;

var calcDir = function(dir) {
    if (dir.indexOf('/') !== 0) {
        dir = path.join(process.env.PWD, dir);
    }
    return dir;
};

sourceDir = calcDir(sourceDir);
for (var i = 0; i < targetDirs.length; i++) {
    targetDirs[i] = calcDir(targetDirs[i]);
}

var eachDir = function(dir, callback) {
    var dirs = dir.split('/').splice(1);
    for (var i = 1; i < dirs.length; i++) {
        callback('/' + path.join.apply(this, dirs.slice(0, i)), i === dirs.length - 1);
    }
};

var stop = function() {
    eachDir(sourceDir, function(dir, last) {
        fs.unwatchFile(dir);
        if (last) {
            stopWatchingContent();
        }
    });
};

var stopWatchingContent = function() {
    if (watcher) {
        watcher.unwatch(sourceDir);
        console.log('unwatched ' + sourceDir);
        watcher = undefined;
    }
};

var start = function() {
    eachDir(sourceDir, function(dir, last) {
        fs.watchFile(dir, function() {
            fs.stat(sourceDir, function(err) {
                if (err) {
                    if (watcher) {
                        stop();
                        setTimeout(existTest, 0);
                    }
                }
            });
        });
        if (last) {
            startWatchingContent();
        }
    });
};

var watcher;
var startWatchingContent = function() {
    var ready = false;
    watcher = chokidar.watch(sourceDir, { ignored: /[\/\\]\./ });

    var done = function(msg) {
        console.log(msg);
    };

    watcher.on('all', function(event, path) {
        if (!ready) {
            return;
        }

        targetDirs.forEach(function(targetDir) {
            var destination = targetDir + path.substring(sourceDir.length);
            var displayedDestination = path.substring(sourceDir.length);
            displayedDestination = displayedDestination ? displayedDestination : '.';

            if (event == 'add' || event == 'change') {
                console.log('copying file ' + displayedDestination);
                ncp(path, destination, done.bind(this, 'copied file ' + displayedDestination));
            } else if (event == 'unlink') {
                if (syncDelete) {
                    console.log('deleting file ' + displayedDestination);
                    fs.unlink(destination, done.bind(this, 'deleted file ' + displayedDestination));
                }
            } else if (event == 'addDir') {
                console.log('copying directory ' + displayedDestination);
                ncp(path, destination, done.bind(this, 'copied directory ' + displayedDestination));
            } else if (event == 'unlinkDir') {
                if (syncDelete) {
                    console.log('deleting directory ' + displayedDestination);
                    rmdir(destination, done.bind(this, 'deleted directory ' + displayedDestination));
                }
            } else {
                console.warn('unknown state: ' + event + ' ' + path);
            }
        });
    });

    watcher.on('ready', function() {
        console.log('watching ' + sourceDir);
        ready = true;
    });
};

var existTest = function() {
    fs.stat(sourceDir, function(err) {
        if (!err) {
            start();
        } else {
            if (err.code == 'ENOENT') {
                console.error(err.path + ' doesn\'t exist.');
            } else {
                console.error(err);
            }
            setTimeout(existTest, 1000);
        }
    });
};
existTest();
