## 实现 runtime-core

### 搭建环境

runtime-core 直接参与页面构建, 我们需要利用打包工具打包代码. 在打包网页时一般使用 webpack, 而在打包模块时一般使用 rollup.js. 安装 rollup 及其 TypeScript 依赖

```bash
pnpm i -D rollup @rollup/plugin-typescript tslib rollup-plugin-sourcemaps
#         ^ 本体  ^ typescript 支持          ^ TS 支持依赖
```

配置 rollup

- 创建 `/package/index.ts` 作为整个项目的出口
- 创建 rollup 配置文件 `/package/rollup.config.js`
  ```js
  import typescript from '@rollup/plugin-typescript';
  import sourceMaps from 'rollup-plugin-sourcemaps';

  export default {
    input: './packages/index.ts', // 入口文件
    output: [
      // 2种输出格式
      {
        format: 'cjs', // 输出格式
        file: './lib/micro-vue.cjs.js', // 输出路径
        sourcemap: true,
      },
      {
        format: 'es',
        file: './lib/micro-vue.esm.js',
        sourcemap: true,
      },
    ],
    plugins: [typescript(), sourceMaps()],
  };
  ```
- 执行 `rollup -c ./rollup.config.js` 打包
- 根据提示将 `tsconfig.json` 中 `"module": "commonjs"` 改为 `"module": "ESNext"`
- 在 `package.json` 中注册包的入口文件, `main` 对应 commonjs 包, `module` 对应 ESM 包
  ```json
  "main": "lib/micro-vue.cjs.js",
  "module": "lib/micro-vue.esm.js",
  ```

### 构造测试用例

我们构造一个简单的 Vue demo 并尝试构建 vue-runtime 主流程使其可以将我们的 demo 渲染出来, Vue 项目一般包含如下文件

- `index.html`: 至少包含一个挂载点
- `index.js`: 引入根组件, 将根组件挂载到挂载点
- `App.vue`: 定义根组件

SFC 需要 vue-loader 编译才能实现. 而 vue-loader 的作用是将 SFC 处理为 `render` 函数, 在此我们只能先将 `App.vue` 处理为 vue-loader 编译后函数. 定义

- `index.html`: 只构造一个挂载点并引入 JS
  ```html
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta http-equiv="X-UA-Compatible" content="IE=edge" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>micro-vue runtime-core</title>
    </head>
    <body>
      <div id="app"></div>
      <script src="./index.js" type="model"></script>
    </body>
  </html>
  ```
- `index.js`: 先不管有没有这些函数, 平时咋写就咋写
  ```js
  import { createApp } from '../../lib/micro-vue.esm';
  import App from './App';

  createApp(App).mount('#app');
  ```
- `App.js`:
  ```js
  import { h } from '../../lib/micro-vue.esm.js';

  export default {
    setup() {},
    render() {
      return h('div', { class: 'title' }, [
        h('span', {}, "111"),
        h('span', {}, "222"),
      ]);
    },
  };
  ```

`App.js` 默认导出了一个配置对象, 该对象应该包含 SFC 中导出的 `setup` 与 vue-loader 编译得到的 `render` 函数. 其中

- `setup` 函数的返回值可以是对象, 也可以是渲染函数
- 在解析 SFC 文件时, 如果用户手动通过 `setup` 返回了渲染函数那么 vue-loader 就不编译模板, 如果没有返回则编译模板并构造渲染函数 `render`. `render` 函数描述了**这个组件里面**应该如何渲染
- `render` 中的 `h` 用于表述一个组件/元素, 语法为: `h(type, attr, children)`.
  - `type`: 描述元素或组件类型, 如果希望将目标渲染为 Element 那么 `type` 为标签名, 如果希望渲染为组件那么 `type` 为 组件配置对象
  - `attr`: 描述元素或组件上的属性(例如: `class`)
  - `children`: 如果这个元素或组件下面没有子元素或者子组件, 那么 `children` 为元素的 `innerText`, 如果下面还有子组件, 那么 `children` 应该是一个 `h` 函数返回值数组

上面这个例子描述了这样一个组件:

- 首先默认导出的是一个组件配置对象

- 这个组件被编译为了 `render` 函数, `render` 函数返回了一个 `h`.

  - **诶, 我要渲染一个组件, 为啥 `h` 的 `type` 是 `div` 而不是配置对象呢?** 一定注意, `render` 描述的是组件**里面**应该如何渲染, 这里的 `h` 是说, App 组件里面有一个 `div`, 如果我们这里写的是 `h(demoObj, {}, '111')` 这个意思是 App 组件里面有一个 demo 组件, 这个 demo 组件里面啥也没有, 他的 innerText 是 '111'

  - **诶, 那我们在哪里定义了 App 的 h 函数呢?** 我们没有用 `h` 函数定义 App (是利用 createApp 定义的) 至于这俩函数有什么联系后面再说

  - **诶, 那难道 App 组件内部只能有一个一级子元素?** 对于 App 下的某个组件(如 demo), 我们让这个组件有多个子元素

    ```js
    // App.js 的 render
    render() {
        return h(demoConfig, { class: 'title' }, [
            h('span', {}, "111"),
            h('span', {}, "222"),
        ]);
    }
    ```

    但是我们没法让 App 组件里面包含多个子元素诶! 因为构造 App 的 `h` 函数不在我们手里. Vue 本身也是这么规定的, 根组件不能包含多个子元素. 就像在 Linux 中你不能构造一个与根目录同级的目录!

    其实我们的疑问就是到底是他妈的谁构造了根组件 `App` 的 `h` 函数

- App 是一个组件, 这个组件内部有一个 `div` 这个 `div` 又有两个子`span`, 内容分别是 `111` 和 `222`


### 构造主流程

- `vue-runtime` 的主流程

  ```mermaid
  graph TB
  根组件配置对象 --createApp--> 一种特殊的vNode --挂载根组件--> 根组件特殊使命结束,成为普通的组件 --渲染--> 进入patch函数 --目标是Element--> Element处理函数 --新Element--> 挂载Element --没有子Element --> 写入innerText
  挂载Element --有子Element--> 每个子Element --渲染--> 进入patch函数
  Element处理函数 --老Element--> 更新Element
  进入patch函数 --目标是组件--> 组件处理函数 --新组件--> 新建组件 --> 应用配置 --> 运行render --> 每个子组件 --渲染--> 进入patch函数
  组件处理函数 --老组件--> 更新组件
  ```

- 可以看到 `createApp` 输入配置对象, `h` 函数输入 `type`(可以是string可以是配置对象), `props`, `children`. 虽然两者输入不同, 但是他们都返回了 vNode. `createApp` 的输入可以看作是没有 `props`, `children` 的 `h` 函数的组件输入, 而 `createApp` 的输出可以看作是具有特殊功能的 `h` 输出. 实际上 `createApp` 与 `h` 在底层都依赖了 `createVNode` 函数.

- vue 渲染中对象发生了如下变化:

  ```mermaid
  graph LR
  组件/元素配置对象 --> 虚拟节点vNode --> 实例对象 --> DOM
  ```

  - 组件配置对象包含了 `render`, `setup`
  - `vNode` 在配置对象的基础上加入了部分属性
  - 实例对象又在 `vNode` 的基础上加入了属性
  - 最后挂载为 DOM

`vue-runtime` 对外暴露函数只有 `createApp` 我们从这个函数入手

- `createApp` 创建了 app 组件 `vNode`, 同时这个的 `vNode` 还应该有 `mount` 函数(唯一特殊的地方)

  ```js
  // @packages/runtime-core/src/createApp.ts
  import { createVNode } from './vnode';
  import { render } from './render';

  export function createApp(rootComponent) {
    return {
      _component: rootComponent,
      mount(container) {
        const vNode = createVNode(rootComponent);
        render(vNode, document.querySelector(container));
      },
    };
  }
  ```

- `createVnode`: 收到配置对象, `props`, `children` 将他们作为一个对象存起来(API 与 `h` 函数一样)

  ```js
  // @packages/runtime-core/src/vnode.ts
  export function createVNode(component, props = {}, children = []) {
    return {
      type: component,
      props,
      children,
    };
  }
  ```

- `render` 负责渲染 `vNode`, 但是 `render` 什么都没做, 只是调用了 `patch`. 这里多此一举是为了方便之后部署子元素时递归方便

  ```js
  // @packages/runtime-core/src/render.ts
  export function render(vNode, container) {
    patch(null, vNode, container); // 第一次创建没有老元素
  }
  ```

- `patch` 函数收入更新前后节点与挂载点(新节点的挂载前节点为 `null`), 针对不同节点类型调用不同处理函数

  ```js
  // @packages/runtime-core/src/render.ts
  export function patch(vNode1, vNode2, container) {
    if (isObject(vNode2.type)) processComponent(vNode1, vNode2, container);
    else processElement(vNode1, vNode2, container);
  }
  ```

- `processComponent` 处理组件

  ```js
  // @packages/runtime-core/src/render.ts
  function processComponent(vNode1, vNode2, container) {
    if (vNode1) return updateComponent(vNode1, vNode2, container); // 老元素就 update
    return mountComponent(vNode2, container); //  新元素就挂载
  }
  ```

  `updateComponent` 暂时没有必要实现

- `mountComponent` 挂载组件. 首先明确组件自己是没有 HTML 标签的, 挂载组件实际上是挂载组件中的子元素. 而组件存在的必要是其导出的 setup 函数中存在子元素需要的变量与函数.

  我们构建组件实例在上面记录组件需要的上下文

  ```js
  // @packages/runtime-core/src/render.ts
  function mountComponent(vNode, container) {
    const instance = createComponent(vNode); // 创建实例
    setupComponent(instance); // 配置实例
    setupRenderEffect(instance.render, container); // 部署实例
  }
  ```

- `createComponent` 用于创建组件实例, 为了方便我们将组件的 type 提到实例上

  ```js
  // @packages/runtime-core/src/component.ts
  export function createComponent(vNode) {
    return {
      vNode,
      type: vNode.type, // 图方便
      render: null,
    };
  }
  ```

- `setupComponent` 用于创建实例, 配置实例, 包括初始化 props, slots, 处理 setup 导出的变量等. 这里我们先不处理 props, slot, 忽略 setup 导出的变量后的归属问题, 只解决

  - 如果有 `setup` 就执行 `setup`, 如果执行结果是对象就将导出对象绑定到 instance 上, 如果是函数就把他当成 `render` 函数
  - 如果没 `render` 就从 `vNode` 的 `type` 上读取 `render`

  ```js
  // @packages/runtime-core/src/component.ts
  export function setupComponent(instance) {
    // initProp
    // initSlot
    setupStatefulComponent(instance);
    finishComponentSetup(instance);
  }

  // 如果有 setup 就处理 setup 函数运行结果
  function setupStatefulComponent(instance) {
    if (instance.type.setup)
      handleSetupResult(instance, instance.type.setup.call(instance));
    finishComponentSetup;
  }

  // 处理 setup 函数运行结果
  function handleSetupResult(instance, res) {
    if (isFunction(res)) instance.render = res;
    else {
      instance.setupResult = res;
    }
    finishComponentSetup(instance);
  }

  // 最后兜底获取 render
  function finishComponentSetup(instance) {
    instance.render = instance.render || instance.type.render;
  }
  ```

- 构建 `instance` 之后需要将中的子元素挂载出去, 递归 `patch` 即可

  ```js
  // @packages/runtime-core/src/component.ts
  export function setupRenderEffect(render, container) {
    const subTree = render(); // render 只能返回 h 函数的结果, 所以一定是一个 vNode, 直接 patch 就行
    // !
    patch(null, subTree, container);
  }
  ```

- 类似的实现 Element 处理功能

  ```js
  // @packages/runtime-core/src/render.ts
  function processElement(vNode1, vNode2, container) {
    if (vNode1) return updateElement(vNode1, vNode2, container);
    return mountElement(vNode2, container);
  }
  ```

- 实现挂载 Element

  ```js
  // @packages/runtime-core/src/render.ts
  function mountElement(vNode, container) {
    const el = document.createElement(vNode.type) as HTMLElement; // 构造 DOM 元素
    // 添加属性
    Object.keys(vNode.props).forEach((k) => el.setAttribute(k, vNode.props[k]));
    // 有子元素
    if (isObject(vNode.children)) {
      vNode.children.forEach((d) => {
        patch(null, d, el); // 递归挂载
      });
    } else el.textContent = vNode.children; // 没子元素
    container.appendChild(el);
  }
  ```

- 最后写下 `h` 函数

  ```js
  // @packages/runtime-core/src/h.ts
  import { createVNode } from "./vnode";
  export const h = createVNode
  ```

### 实现组件实例 `Proxy`

我们想要让组件可以引用自己导出的变量

```js
export default {
  setup() {
    return {
      message: ref('micro-vue'),
    };
  },
  render() {
    return h('div', { class: 'title' }, 'hi ' + this.message);
  },
};
```

但是因为我们直接调用了 `render` 函数

```js
// @packages/runtime-core/src/component.ts
export function setupRenderEffect(render, container) {
  const subTree = render();
  // ...
}
```

所以 `render` 的 `this` 是 `global`, 我们希望 `render` 的 `this` 包括 `setup` 导出的对象与 Vue 3 文档中的[组件实例](https://cn.vuejs.org/api/component-instance.html), 所以我们需要构造一个 Proxy 同时实现访问 setup 结果与组件对象

1. 处理 setup 导出

  ```ts
  // @packages/runtime-core/src/component.ts
  function handleSetupResult(instance, res) {
    // ...
    instance.setupResult = proxyRefs(res);
    // ...
  }
  ```

2. 在结束组件初始化时构造代理对象, 将代理对象作为一个属性插入实例
  ```ts
  // @packages/runtime-core/src/component.ts
  function finishComponentSetup(instance) {
    // 声明代理对象
    instance.proxy = new Proxy({ instance }, publicInstanceProxy);
    instance.render = instance.render || instance.type.render;
  }
  ```
  将 `target` 定义为 `{ instance }` 看起来很怪, 为啥不直接用 `instance` 呢? 因为在 DEV 模式下这个对象内部应该还有很多属性, 只不过我们没有考虑
3. 定义代理
  ```ts
  // @packages/runtime-core/src/publicInstanceProxy.ts
  const specialInstanceKeyMap = {
    $el: (instance) => instance.vNode.el,
  };

  export const publicInstanceProxy = {
    get(target, key, receiver) {
      // 如果 setup 导出的对象上有就返回
      if (Reflect.has(target.instance.setupResult, key))
        return Reflect.get(target.instance.setupResult, key);
      // 从组件属性上导出属性
      if (key in specialInstanceKeyMap)
        return specialInstanceKeyMap[key](target.instance);
      return target.instance[key];
    },
  };
  ```
4. 实现 `$el`

  有很多组件实例, 我们暂时只实现 `$el`. 挂载点应该是 `vNode` 的属性, 所以我们将挂载点记录在 `vNode` 上

  ```ts
  // @packages/runtime-core/src/vnode.ts
  export function createVNode(component, props = {}, children = []) {
    return {
      // ...
      el: null,
    };
  }
  ```
  `el` 作为组件实例在组件挂载后在 vNode 上更新即可

  ```ts
  // @packages/runtime-core/src/publicInstanceProxy.ts
  export function setupRenderEffect(instance, container) {
    // ...
    instance.vNode.el = container;
  }
  ```