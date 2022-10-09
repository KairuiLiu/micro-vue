import { isObject } from '../../share/index';
import {
  createComponent,
  setupComponent,
  setupRenderEffect,
} from './component';

export function render(vNode, container) {
  patch(null, vNode, container); // 第一次创建没有老元素
}

export function patch(vNode1, vNode2, container) {
  if (isObject(vNode2.type)) processComponent(vNode1, vNode2, container);
  else processElement(vNode1, vNode2, container);
}

function processComponent(vNode1, vNode2, container) {
  if (vNode1) return updateComponent(vNode1, vNode2, container);
  return mountComponent(vNode2, container);
}

function updateComponent(vNode1, vNode2, container) {}

function mountComponent(vNode, container) {
  const instance = createComponent(vNode);
  setupComponent(instance);
  setupRenderEffect(instance, container);
}

function processElement(vNode1, vNode2, container) {
  if (vNode1) return updateElement(vNode1, vNode2, container);
  return mountElement(vNode2, container);
}

function updateElement(vNode1, vNode2, container) {}

function mountElement(vNode, container) {
  const el = document.createElement(vNode.type) as HTMLElement;
  Object.keys(vNode.props).forEach((k) => el.setAttribute(k, vNode.props[k]));
  if (isObject(vNode.children)) {
    vNode.children.forEach((d) => {
      patch(null, d, el);
    });
  } else el.textContent = vNode.children;
  container.appendChild(el);
}