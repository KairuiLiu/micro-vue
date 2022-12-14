import { createApp } from './createApp';
import { LIS } from '../../share';
import {
  createComponent,
  isSameProps,
  setupComponent,
  setupRenderEffect,
} from './component';
import { ShapeFlags } from './shapeFlags';
import { typeSymbol } from './vnode';

export function createRenderer({
  createElement,
  createText,
  remove,
  insert,
  setText,
  setElementText,
  patchProps,
}) {
  function render(vNode, container) {
    patch(null, vNode, container); // 第一次创建没有老元素
  }

  function patch(vNode1, vNode2, container, parent = null, anchor = null) {
    switch (vNode2.type) {
      case typeSymbol.FragmentNode:
        processFragmentNode(vNode1, vNode2, container, parent, anchor);
        break;
      case typeSymbol.TextNode:
        processTextNode(vNode1, vNode2, container, anchor);
        break;
      default:
        if (vNode2.shapeFlags & ShapeFlags.ELEMENT)
          processElement(vNode1, vNode2, container, parent, anchor);
        else processComponent(vNode1, vNode2, container, parent, anchor);
    }
  }

  function processFragmentNode(vNode1, vNode2, container, parent, anchor) {
    if (vNode1) return;
    return mountFragmentNode(vNode2, container, parent, anchor);
  }

  function mountFragmentNode(vNode, container, parent, anchor) {
    vNode.children.forEach((d) => patch(null, d, container, parent, anchor));
  }

  function processTextNode(vNode1, vNode2, container, anchor) {
    if (vNode1) return setText(vNode1.el, vNode2.children);
    return mountTextNode(vNode2, container, anchor);
  }

  function mountTextNode(vNode, container: HTMLElement, anchor) {
    const elem = (vNode.el = createText(vNode.children));
    insert(elem, container, anchor);
  }

  function processComponent(vNode1, vNode2, container, parent, anchor) {
    if (vNode1)
      return updateComponent(vNode1, vNode2, container, parent, anchor);
    return mountComponent(vNode2, container, parent, anchor);
  }

  function updateComponent(vNode1, vNode2, container, parent, anchor) {
    vNode2.el = vNode1.el;
    vNode2.component = vNode1.component;
    if (isSameProps(vNode1.props, vNode2.props)) {
      vNode1.component.vNode = vNode2;
    } else {
      vNode1.component.next = vNode2;
      vNode1.component?.runner && vNode1.component.runner();
    }
  }

  function mountComponent(vNode, container, parent, anchor) {
    const instance = createComponent(vNode, parent);
    vNode.component = instance;
    setupComponent(instance);
    setupRenderEffect(instance, container, anchor, patch);
  }

  function processElement(vNode1, vNode2, container, parent, anchor) {
    if (vNode1) return updateElement(vNode1, vNode2, container, parent, anchor);
    return mountElement(vNode2, container, parent, anchor);
  }

  function updateElement(vNode1, vNode2, container, parent, anchor) {
    const elem = (vNode2.el = vNode1.el);
    patchProps(elem, vNode1?.props, vNode2.props);
    updateChildren(vNode1, vNode2, elem, parent, anchor);
  }

  function updateChildren(vNode1, vNode2, container, parent, anchor) {
    if (vNode2.shapeFlags & ShapeFlags.TEXT_CHILDREN) {
      if (vNode1.shapeFlags & ShapeFlags.ARRAY_CHILDREN)
        [...container.children].forEach((d) => remove(d));
      if (vNode2.children !== vNode1.children)
        setElementText(container, vNode2.children);
    } else {
      if (vNode1.shapeFlags & ShapeFlags.TEXT_CHILDREN) {
        setElementText(container, '');
        vNode2.children.forEach((element) => {
          patch(null, element, container, parent, null);
        });
      } else {
        patchKeyedChildren(
          vNode1.children,
          vNode2.children,
          container,
          parent,
          anchor
        );
      }
    }
  }

  function patchKeyedChildren(c1: any[], c2: any[], container, parent, anchor) {
    let i = 0,
      e1 = c1.length - 1,
      e2 = c2.length - 1;
    const isSameType = (v1, v2) =>
      v1.type === v2.type && v1.props.key === v2.props.key;
    // 找到区间
    for (; i <= Math.min(e1, e2); i += 1)
      if (!isSameType(c1[i], c2[i])) break;
      else patch(c1[i], c2[i], container, parent, anchor);
    for (; e1 >= 0 && e2 >= 0; e1 -= 1, e2 -= 1)
      if (!isSameType(c1[e1], c2[e2])) break;
      else patch(c1[e1], c2[e2], container, parent, anchor);
    // 特判
    if (e2 < i && i <= e1) c1.slice(i, e1 + 1).forEach((d) => remove(d.el));
    else if (e1 < i && i <= e2)
      c2.slice(i, e2 + 1).forEach((d) =>
        patch(
          null,
          d,
          container,
          parent,
          e1 + 1 >= c1.length ? null : c1[e1 + 1].el
        )
      );
    // 中间
    else if (i <= Math.min(e1, e2)) {
      const newRange = c2.slice(i, e2 + 1);
      const oldRange = c1.slice(i, e1 + 1);
      const new2oldIndex = new Map();
      const key2indexNew = new Map(
        newRange.map((d, idx) => [d.props.key, i + idx])
      );

      oldRange.forEach((vnode, idx) => {
        if (key2indexNew.has(vnode.props.key)) {
          new2oldIndex.set(key2indexNew.get(vnode.props.key), idx);
        } else remove(vnode.el);
      });
      const lis = LIS([...new2oldIndex.keys()]);
      newRange.reduceRight(
        (prev, cur, curIndex) => {
          const oldVnode = oldRange[new2oldIndex.get(curIndex + i)];
          if (lis.includes(curIndex + i))
            return patch(oldVnode, cur, container, parent, prev?.el);
          if (new2oldIndex.has(curIndex + i)) {
            insert(oldVnode.el, container, prev?.el);
            patch(oldVnode, cur, container, parent, prev?.el);
          } else patch(null, cur, container, parent, prev?.el);
          return cur;
        },
        e2 + 1 >= c2.length ? null : c2[e2 + 1]
      );
    }
  }

  function mountElement(vNode, container, parent, anchor) {
    const el = (vNode.el = createElement(vNode.type) as HTMLElement);
    patchProps(el, {}, vNode.props);
    if (vNode.shapeFlags & ShapeFlags.ARRAY_CHILDREN) {
      vNode.children.forEach((d) => {
        patch(null, d, el, parent, anchor);
      });
    } else setElementText(el, vNode.children);
    insert(el, container, anchor);
  }

  return {
    render,
    createApp: createApp.bind(null, render),
  };
}
