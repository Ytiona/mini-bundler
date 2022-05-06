const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
// 该模块默认是esmodule导出，所以需要加.default
const traverse = require('@babel/traverse').default;
const babel = require('@babel/core');

// 模块分析，依赖收集
function moduleAnalyser(filename) {
  const content = fs.readFileSync(filename, 'utf-8');
  const ast = parser.parse(content, {
    sourceType: 'module',
  })
  const dependencies = {};
  traverse(ast, {
    ImportDeclaration({ node }) {
      const dirname = path.dirname(filename);
      const newFile = './' + path.join(dirname, node.source.value);
      // 依赖收集（import）
      dependencies[node.source.value] = newFile;
    }
  })
  // 解析ast语法树，生成能让浏览器执行的代码
  const { code } = babel.transformFromAst(ast, null, {
    presets: ['@babel/preset-env']
  });
  return {
    filename,
    dependencies,
    code
  }
}

// 生成依赖图谱
function makeDependciesGraph(entry) {
  const entryModule = moduleAnalyser(entry);
  const graphArr = [entryModule];
  for(let i = 0; i < graphArr.length; i++) {
    const item = graphArr[i];
    const { dependencies } = item;
    if(dependencies) {
      for(let j in dependencies) {
        // 模拟递归，不断往graphArr添加依赖，及依赖下的依赖...
        graphArr.push(moduleAnalyser(dependencies[j]));
      }
    }
  }

  // 格式转换
  const graph = {};
  graphArr.forEach(item => {
    graph[item.filename] = {
      dependencies: item.dependencies,
      code: item.code
    }
  })

  return graph;
}

function generateCode(entry) {
  const graph = makeDependciesGraph(entry);
  return `
    (function(graph) {
      function require(module) {
        // 相对路径转换
        function localRequire(relativePath) {
          return require(graph[module].dependencies[relativePath]);
        }
        // 存储导出
        var exports = {};
        (function (require, exports, code) {
          // code中的require，实际是使用的localRequire
          eval(code);
        }(localRequire, exports, graph[module].code))
        // 返回导出，供其他模特require
        return exports;
      }
      require('${entry}')
    }(${JSON.stringify(graph)}))
  `
}

const code = generateCode('./src/index.js');

console.log(code);


/**
 * 1、模块依赖收集，原理是通过ast语法书获取import节点，babel有一个可以生成ast语法书的工具(babel/parser)；
 * 2、将ast语法书通过babel转换，生成能让浏览器认识的代码；
 * 3、通过递归查找依赖，及依赖下的依赖，最终生成依赖图谱；
 * 4、最后通过依赖图谱生成代码，通过立即执行函数隔离模块；
 */

