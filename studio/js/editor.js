// lazy, terrible code ahead

let editor;
let currentName = 'default';
let tabs = {};
let tabIndex = 0;
let curProject = null;

function createFile() {
    if (curProject) {
        let file = prompt('File name (or cancel): ', '');
        if (file == null) return false;
        file = file.replace(/\.tl$/i, '');
        file = file + '.tl';
        setTab(createTab(file));
    }
    return false;
}
function delProj(name) {
    let proj = localStorage['~timelineproject.$' + name];
    if (proj) {
        if (confirm('Are you really sure? YOU CANNOT UNDO THIS ACTION!')) {
            delete localStorage['~timelineproject.$' + name];
        }
    }
    location.reload();
    return false;
}
function delTab(index) {
    let tab = Object.values(tabs).find(n => n.index === index);
    if (tab.name === 'main.tl') return false;
    if (tab) {
        if (confirm('Are you really sure you wanna DELETE the file ' + tab.name + '?\nYOU CANNOT UNDO THIS ACTION!')) {
            tab.model.dispose();
            tab.el.hide();
            tab.index = -1;
            delete tabs[tab.name];
            let nfiles = [];
            for (let file of curProject.files) {
                if (file.name !== tab.name) nfiles.push(file);
            }
            curProject.files = nfiles;
            tab.name = Date.now() + '~disposed~' + Math.random();
            setTab(tabs['main.tl']);
        }
    }
}
function downProj(name, self) {
    if (!self.ddurl) self.ddurl = true;
    let proj = localStorage['~timelineproject.$' + name];
    if (proj) {
        var blob = new Blob([proj], {
            type: "text/javascript"
        });
        $(self).attr('target', '_blank');
        $(self).attr('download', name + '-' + Date.now() + '.json');
        $(self).attr('href', URL.createObjectURL(blob));
    }
}
function setTab(tab) {
    editor.setModel(tab.model);
    $('a.selected').removeClass('selected');
    tab.el.addClass('selected');
    if (curProject) curProject.tab = tab.name;
}
function selTab(index) {
    for (let o in tabs) {
        if (tabs[o].index === index) {
            setTab(tabs[o]);
            break;
        }
    }
    return false;
}
function createTab(name) {
    if (!editor) return;
    name = name.replace(/[<>"&]/g, '_')
    if (tabs[name]) {
        setTab(tabs[name]);
        return tabs[name];
    }
    let source = '// your code goes here\n';
    if (curProject) {
        let hasFile = curProject.files.find(n => n.name === name);
        if (hasFile) {
            source = hasFile.contents;
        }
    }
    let model = monaco.editor.createModel(source, 'timeline', new monaco.Uri.file(name));
    let tab = tabs[name] = {
        name,
        index: tabIndex++,
        el: $('<a href="#" title="Click to select tab\nDouble click to prompt-delete" data-index="' + (tabIndex - 1) + '" ondblclick="delTab($(this).data(\'index\'));return false;" onclick="selTab($(this).data(\'index\'));return false;">' + name + '</a>'),
        model,
    };
    $('#tabs').append(tab.el);
    return tab;
}
function saveAndExit() {
    if (confirm('Save current project and exit?')) {
        saveProject(curProject);
        location.hash = '#';
        setTimeout(() => {
            location.reload();
        }, 700);
    }
}
function saveProject(proj, silent) {
    let old = localStorage[proj.id] ? JSON.parse(localStorage[proj.id]) : null;
    if (old) {
        for (let file of proj.files) {
            let hasOld = old.files.find(f => f.name === file.name);
            if (hasOld) {
                if (hasOld.contents !== file.contents) {
                    file.modified = Date.now();
                    file.incr++;
                }
            } else {
                file.modified = Date.now();
            }
        }
    }
    if (!proj.version) {
        proj.version = 1;
    }
    if (!proj.meta) {
        proj.meta = {};
    }
    proj.modified = Date.now();
    proj.incr++;
    if (proj.id) localStorage[proj.id] = JSON.stringify(proj);
    if (!silent) toastr.success('Project saved!');
}
function initProject(name) {
    let key = '~timelineproject.$' + name;
    let proj = (localStorage[key] ? JSON.parse(localStorage[key]) : null) || {
        id: key,
        name,
        incr: 0,
        tab: 'main.tl',
        created: Date.now(),
        modified: Date.now(),
        version: 1,
        meta: {},
        assets: [{ name: 'readme.txt', created: Date.now(), encoding: 'text', contents: 'Yayy! This timeline project was created ' + moment().format('LLLL') + '\n' }],
        files: [{
            name: 'main.tl',
            created: Date.now(),
            modified: Date.now(),
            incr: 0,
            contents: '// Project ' + name + '\n// This is the entry point for your project\n',
        }],
    };
    curProject = proj;
    $('#projName').text(proj.name);
    console.log('Project %s opened!', proj.name);
    for (let v of proj.files) {
        createTab(v.name);
    }
    setTimeout(() => {
        if (tabs[proj.tab]) {
            setTab(tabs[proj.tab]);
        }
    }, 50);
}
function initMonaco() {
    require.config({ paths: { 'vs': 'monaco-editor/min/vs' } });

    require(['vs/editor/editor.main'], function () {
        if (editor) return;

        monaco.languages.register({ id: 'timeline' });
        monaco.languages.setMonarchTokensProvider('timeline', {
            tokenizer: {
                root: [
                    [/^(\s*\}\s*)([0-9a-zA-Z_$+~]+)/, ['', "keyword"]],
                    [/^(\s*)(module|export)(\s+)([0-9a-zA-Z_$+~]+)/, ['', 'custom-info', '', "modvar"]],
                    [/^(\s*)(import)(\s+)([0-9a-zA-Z_$+\\-~]+)(\s+)(from)(\s+)([^\s]+)(\s+)(as)(\s+)([0-9a-zA-Z_$+\\-~]+)$/, ['', 'custom-info', '', 'modvar', '', 'custom-info', '', 'modvar', '', 'custom-info', '', 'modvar']],
                    [/^(\s*)(import)(\s+)([0-9a-zA-Z_$+\\-~\s,{}]+)(\s+)(from)(\s+)([^\s]+)$/, ['', 'custom-info', '', 'modvar', '', 'custom-info', '', 'modvar']],
                    [/\/\/\s*{/, { token: 'bracket-open', bracket: '@open', next: '@rawjs', nextEmbedded: 'text/javascript' }],
                    [/\/\/.*/, "comment"],
                    [/\{/, { token: 'bracket-open', bracket: '@open' }],
                    [/\}/, { token: 'bracket-close', bracket: '@close' }],
                    [/^(\s*)(cmd|cmdg|js]+)(\s*?[0-9a-zA-Z_$+~]+)?(\s*)(\{)/, ['rawjs-n', { token: 'custom-cmdg' }, 'rawjs-n', 'rawjs-n', { token: 'rawjs-n', bracket: '@open' }]],
                    [/^\s*([0-9a-zA-Z_$+~]+)/, "keyword"],
                    [/^\s*\#([0-9a-zA-Z_$+~]+)/, "custom-info"],
                    [/("|')((?:\\\1|(?:(?!\1).))*)\1/, "string"],
                    [/([0-9\.x\:]+)/, "number"],
                    [/(#)(\{)([^}]+?)(\})/, ["custom-raw", "custom-ecc", "expression", "custom-ecc"]],
                    [/(\$)(\{)([^}]+?)(\})/, ["custom-raw", "custom-ecc", "expression", "custom-ecc"]],
                    [/\$([0-9a-zA-Z_]+)/, "custom-var"],
                ],
                rawjs: [
                    [/\/\/\s*}/, { token: 'bracket-close', bracket: '@close', nextEmbedded: '@pop', next: '@pop' }],
                ]
            }
        });
        monaco.editor.defineTheme('timeline-theme', {
            base: 'vs-dark',
            inherit: true,
            rules: [
                { token: 'custom-var', foreground: 'f5da42' },
                { token: 'custom-cmdg', foreground: '51db68' },
                { token: 'custom-info', foreground: '808080' },
                { token: 'custom-error', foreground: 'ff0000', fontStyle: 'bold' },
                { token: 'custom-notice', foreground: 'FFA500' },
                { token: 'custom-raw', foreground: '808080', fontStyle: 'italic' },
                { token: 'modvar', foreground: 'cccccc', fontStyle: 'italic' },
                { token: 'custom-ecc', foreground: '8532a8' },
                { token: 'expression', foreground: 'de2fd5' },
            ]
        });

        console.log('Creating editor...');
        $('body').append('<div id="code"></div>');
        editor = monaco.editor.create(document.getElementById('code'), {
            theme: 'timeline-theme',
            value: '',
            autoClosingTags: false,
            autoClosingBrackets: false,
            language: 'timeline',
            automaticLayout: true
        });
        initProject(currentName);
        console.log('Loaded.');
    });
}
createTimelinePreview = function (viewonly, buildonly) {
    if (!editor) return false;
    let header =
        `// Timeline
// Copyright (C) 2020 - Drizer

// Project ${curProject.name} (created ${moment(curProject.created).format('LLLL')})
// Compiled ${moment().format('LLLL')}

`;
    let code = tabs['main.tl'].model.getValue();
    let libdata = '';
    for (let file of curProject.files) {
        if (file.name !== 'main.tl') {
            libdata += '\n#libdef ' + file.name + '\n';
            libdata += tabs[file.name].model.getValue();
            libdata += '\n#endlibdef\n';
        }
    }
    libdata += '\n';
    if (buildonly) {
        (async function () {
            var blob = new Blob([`<!doctype html>
<script>${await fetch('js/jquery.min.js').then(r => r.text())}</script>
<script>${await fetch('js/timeline.js').then(r => r.text())}</script>
<script>${await fetch('js/libs.combined.js?r=' + Date.now()).then(r => r.text())}</script>
<textarea id="____timelinecompiledsource" style="display:none">
${header + libdata + code}
</textarea>
<style>
html, body {
    padding: 0;
    margin: 0;
    width:100%;
    height: 100%;
    overflow: hidden;
    background:#111;
    color:#ddd;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    font-size: 18px;
}
a {
    color:#eee;
    text-decoration: none;
}
a:hover {
    text-decoration: underline;
}
</style>
<script>
(function() {new TimelineCompiler($('#____timelinecompiledsource').val()).execute()})();
</script>`], {
                type: "text/html"
            });
            if (window.lastCompiledURL) {
                URL.revokeObjectURL(window.lastCompiledURL);
            }
            let url = URL.createObjectURL(blob);
            window.lastCompiledURL = url;
            let link = $('<a download="' + curProject.name + '_' + curProject.incr + '.html" href="' + url + '"></a>');
            link[0].click();
        })();
        return;
    }
    if (viewonly) {
        try {
            let compiler = new TimelineCompiler(libdata + code);
            var blob = new Blob([header + compiler.program.source.replace(/(^\r?\n){2,}/gm, '').replace(/___DATA_REF___ (\d+)/g, function ($0, $1) {
                return compiler.program.rawDataRegions[(~~$1) - 1].data;
            })], {
                type: "text/plain"
            });
        } catch (e) {
            postMessage({ msg: 'notify', error: e.message })
            return;
        }
        if (window.lastCompiledURL) {
            URL.revokeObjectURL(window.lastCompiledURL);
            $('#framePreview').remove();
        }
        let vurl = URL.createObjectURL(blob);
        window.lastCompiledURL = vurl;
        window.open(vurl);
        return;
    }

    var blob = new Blob([header + libdata + code], {
        type: "text/plain"
    });
    if (window.lastCompiledURL) {
        URL.revokeObjectURL(window.lastCompiledURL);
        $('#framePreview').remove();
    }
    let url = URL.createObjectURL(blob);
    window.lastCompiledURL = url;
    $('body').append('<iframe id="framePreview" style="position:fixed;background:#111;left:0;top:0;bottom:0;right:0;border:none;width:100%;height:100%" scrolling="no" src="playground.html#' + url + '"></iframe>');
    $('#framePreview').focus();
}
onmessage = function (ev) {
    if (!ev.data) return;
    if (ev.data.msg == 'close') {
        $('#framePreview').remove();
        setTimeout(() => editor.focus(), 100);
        if (ev.data.stack) {
            toastr.error(ev.data.stack);
        }
        if (ev.data.success) {
            toastr.success(ev.data.success);
        }
    } else if (ev.data.msg == 'notify') {
        if (ev.data.info) {
            toastr.info(ev.data.info);
        } else if (ev.data.error) {
            toastr.error(ev.data.error);
        } else if (ev.data.warning) {
            toastr.warning(ev.data.warning);
        } else if (ev.data.success) {
            toastr.success(ev.data.success);
        }
    }
}
let isFrame = false;
onload = () => {
    $('[data-action]').click(function (ev) {
        switch ($(this).data('action')) {
            case 'buildhtml':
                createTimelinePreview(false, true);
                break;
            case 'build':
                createTimelinePreview();
                break;
            case 'confirmq':
                if (confirm('Go to main page? Unsaved changes will be lost!')) {
                    location.hash = '#';
                    setTimeout(() => {
                        location.reload();
                    }, 1000);
                }
                break;
            case 'buildview':
                createTimelinePreview(true);
                break;
            case 'save':
                if (curProject) {
                    saveProject(curProject);
                }
                break;
            case 'saveexit':
                if (curProject) {
                    saveAndExit();
                }
                break;
            case 'new':
                if (curProject) {
                    createFile();
                }
                break;
        }
        ev.preventDefault();
        return false;
    });
    if (location.hash && location.hash.substring(1) !== '' && location.hash.substr(1)[0] !== '!') {
        isFrame = true;
        $.ajax(location.hash.substring(1), {
            success: (response) => {
                try {
                    let compiler = new TimelineCompiler(response);
                    compiler.execute().then(result => {
                        try {
                            if (compiler.compilationError) throw new Error(compiler.compilationError);
                            top.postMessage({ msg: 'notify', success: 'Executed successfully!<br>Press <b>ESC</b> to close preview.' })
                        } catch (e) {
                            top.postMessage({ msg: 'close', stack: e.message })
                        }
                    });
                } catch (e) {
                    top.postMessage({ msg: 'close', stack: e.stack })
                }
            }
        });
    } else {
        if (location.pathname.endsWith('playground.html')) {
            $('body').append('<br><center><h1>There is nothing to run.</h1></center>');
            return;
        }
        if (location.hash.substring(1)) {
            $('#tabs-wrapper').show();
            currentName = location.hash.substring(2);
            initMonaco();
            return;
        }
        let files = [];
        for (let s in localStorage) {
            if (s.startsWith('~timelineproject.$')) files.push(s.substring('~timelineproject.$'.length));
        }
        $('body').prepend(`
            <div style="width:100%; height:100%;position:absolute; z-index:0; background-image:url(assets/background.jpg); background-size:cover"></div>
            <div id="__" style="text-align:center;position:absolute;z-index:1;left:calc(50% - 312px)">
            <div style="background:rgba(10,10,10,0.9);display:inline-block;width:575px;height:auto; text-align:left; border:1px solid #222; padding:25px; margin-top:40px">
                <h1 style="margin-top:-10px;text-decoration:none; font-weight:normal"><i><b>Timeline</b>Studio</i></h1>
                New Project: <input maxlength="34" type="text" id="name" placeholder="" onkeydown="if(event.keyCode===13){$('#yeah')[0].click(); return false;}" /> <button id="yeah" onclick="if(!$('#name').val().trim()) return false;location.hash='#!'+$('#name').val().replace(/ /g, '_');location.reload(); return false;">Create</button>
                <div style="font-size:small;margin-top:5px"><small>Drop a .json file to import a downloaded project.</small></div>
            <div style="margin-top:20px; margin-bottom:5px"><b>Projects</b></div>
            <table id="files" style="width:100%"></table>
            <small style="font-size:12px; color:#ccc;padding-top:20px;display:block">TimelineStudio by Drizer (c) 2020</small>
            </div>
            </div>
            `);
        files = files.map(n => ({ _name: n, ...JSON.parse(localStorage['~timelineproject.$' + n]) })).sort((l, r) => r.modified - l.modified);
        for (let file of files) {
            $('#files').append('<tr style="font-size:14px"><td>[<a href="#" onclick="downProj($(this).data(\'name\'), this)" data-name="' + file._name + '" title="Download">d</a>] [<a onclick="delProj($(this).data(\'name\'))" data-name="' + file._name + '" href="#" title="Delete">x</a>]</td> <td><a title="Open" href="#" onclick="currentName=$(this).text();location.hash=\'#!' + file._name + '\';location.reload();return false;"><b>' + (file.id !== '~timelineproject.$' + file.name ? (file.name + ' <small style="font-size:10px">(' + file.id.substring('~timelineproject.$'.length) + ')</small>') : file._name) + '</b></a></td><td><b>' + moment(file.created).fromNow() + '</b></td><td><b>' + moment(file.modified).fromNow() + '</b></td></tr>');
        }
        if (!files.length) $('#files').append('<tr><td><i>No Projects Created</i></td></tr>'); else {
            $('#files').prepend('<tr style="font-size:14px;"><th style="width:70px">Action</th><th>Name</th><th>Created</th><th>Modified</th></tr>');
        }
        document.body.addEventListener('drop', function (ev) {
            ev.preventDefault();
            var reader = new FileReader();
            reader.onload = function (event) {
                try {
                    curProject = JSON.parse(event.target.result);
                    curProject.id = curProject.id.replace(/_imported_\d+/gi, '') + '_imported_' + (Date.now() + '').substr(0, 9);
                    // curProject.name = curProject.id.substr('~timelineproject.$'.length);
                    saveProject(curProject, true);
                    location.reload()
                } catch (e) {
                    toastr.error(e.message);
                }
            };
            reader.readAsText(ev.dataTransfer.files[0]);
        })
        $('body').on('dragover', function dragOverHandler(ev) {
            ev.preventDefault();
        });
    }
}
let keydownhooks = [];
function addKeydownHook(callback) {
    keydownhooks.push(callback);
}
addEventListener('keydown', ev => {
    for (let hook of keydownhooks) {
        if (hook(isFrame, ev) === false) return false;
    }
    if (!isFrame && ev.ctrlKey && ev.shiftKey && ev.keyCode == 81) {
        createTimelinePreview(true);
        ev.preventDefault();
        return false;
    } else if (!isFrame && ev.ctrlKey && ev.shiftKey && ev.keyCode == 88) {
        saveAndExit();
        ev.preventDefault();
        return false;
    } else if (ev.keyCode == 27) {
        if (isFrame) {
            top.postMessage({ msg: 'close' });
        } else $('#framePreview').remove();
    } else if (ev.ctrlKey && ev.shiftKey && ev.keyCode == 66) {
        createTimelinePreview();
        ev.preventDefault();
        return false;
    } else if (!isFrame && ev.ctrlKey && ev.keyCode == 83) {
        for (let key of Object.keys(tabs)) {
            let contents = tabs[key].model.getValue();
            let exists = curProject.files.find(n => n.name === key);
            if (exists) {
                if (exists.contents !== contents) {
                    exists.contents = contents;
                    // console.log('Updated file: %s', key);
                }
            } else {
                curProject.files.push({
                    name: key,
                    created: Date.now(),
                    modified: Date.now(),
                    incr: 0,
                    contents,
                });
                console.log('New file in project: %s', key);
            }
        }
        ev.preventDefault();
        if (curProject) {
            saveProject(curProject);
        }
        return false;
    }
});
