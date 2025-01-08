import { Generate, callPopup, chat, eventSource, event_types, messageFormatting, saveChatConditional, saveChatDebounced, saveSettingsDebounced, substituteParams } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';
import { delay } from '../../../utils.js';
import { ContextMenu } from './src/ContextMenu.js';
import { MenuItem } from './src/MenuItem.js';




const log = (...msg)=>console.log('[MFC]', ...msg);
const busy = ()=>{
    /**@type {HTMLElement} */
    const el = document.querySelector('.mes_stop');
    return el.offsetHeight !== 0 || el.offsetWidth !== 0;
};




let settings;
if (!extension_settings.moreFlexibleContinues) {
    extension_settings.moreFlexibleContinues = {
        buttonsTop: true,
        buttonsBottom: true,
        hotkey: ''
    };
}
settings = extension_settings.moreFlexibleContinues;




let isListening = false;
let startMes;
const insertContinueData = (mes)=>{
    if (!mes.continueHistory || !mes.continueHistory[mes.swipe_id ?? 0]) {
        if (!mes.continueHistory) {
            mes.continueHistory = (mes.swipes ?? [mes.mes]).map(it=>({
                mes: it,
                swipes: [],
                parent: [],
                active: null,
            }));
        } else if (!mes.continueHistory[mes.swipe_id ?? 0]) {
            mes.continueHistory[mes.swipe_id ?? 0] = {
                mes: mes.swipe_id === undefined ? mes.mes : mes.swipes[mes.swipe_id],
                swipes: [],
                parent: [],
            };
        }
        mes.continueSwipeId = mes.swipe_id ?? 0;
        mes.continueSwipe = mes.continueHistory[mes.swipe_id ?? 0];
        mes.continueHistory[mes.swipe_id ?? 0].active = [...mes.continueSwipe.parent, mes.continueSwipeId];
    }
};
const onGenerationStarted = async(type, namedArgs, dryRun)=>{
    log('onGenerationStarted', { type, dryRun });
    if (dryRun || !['continue', 'normal', 'swipe'].includes(type)) return;
    const mes = chat.slice(-1)[0];
    insertContinueData(mes);
    if (type == 'continue') {
        isListening = true;
        startMes = mes.mes;
    } else if (type == 'swipe') {
        isListening = true;
        startMes = '';
    }
    log('[GENERATION_STARTED]', chat.slice(-1)[0].mes, chat.slice(-1)[0]);
};

let hoverMes;
let hoverOverlay;
const onUnhover = ()=>{
    // log('[UNHOVER]');
    hoverOverlay?.remove();
    hoverMes?.classList?.remove('mfc--hover');
};
const onHover = ()=>{
    if (busy()) return;
    // log('[HOVER]');
    const mes = chat.slice(-1)[0];
    if (mes.continueSwipe?.parent?.length) {
        let swipe;
        let swipes = mes.continueHistory;
        let text = '';
        mes.continueSwipe.parent.forEach(idx=>{
            swipe = swipes[idx];
            swipes = swipe.swipes;
            text += swipe.mes;
        });
        let messageText = substituteParams(text);
        messageText = messageFormatting(
            messageText,
            mes.name,
            false,
            mes.is_user,
        );
        const el = document.querySelector('#chat .last_mes .mes_text');
        hoverMes = el;
        const html = document.createElement('div');
        hoverOverlay = html;
        html.classList.add('mfc--hoverOverlay');
        html.innerHTML = messageText;
        html.style.padding = window.getComputedStyle(el).padding;
        el.classList.add('mfc--hover');
        el.append(html);
    }
};

document.body.addEventListener('keyup', function (e) {
    if(e.code == settings.hotkey)
    {
        console.log('[MFC] Hotkey Detected');
        if(last_regen)
            last_regen.click();
    }
});

let last_regen = null;
const buildSwipeDom = (mfc, el)=>{
    const dom = document.createElement('div'); {
        dom.classList.add('mfc--root');
        dom.setAttribute('data-mfc', mfc);
        const undoTrigger = document.createElement('span'); {
            undoTrigger.classList.add('mfc--undo');
            undoTrigger.classList.add('mfc--action');
            undoTrigger.textContent = '↶';
            undoTrigger.title = 'Remove last continue';
            undoTrigger.addEventListener('pointerenter', onHover);
            undoTrigger.addEventListener('pointerleave', onUnhover);
            undoTrigger.addEventListener('click', ()=>{
                if (busy()) return;
                log('[UNDO]');
                const mes = chat.slice(-1)[0];
                if (mes.continueSwipe?.parent?.length) {
                    let swipeIdx;
                    let swipe;
                    let swipes = mes.continueHistory;
                    swipes[mes.continueSwipe.parent[0]].active.pop();
                    let text = '';
                    mes.continueSwipe.parent.forEach(idx=>{
                        swipeIdx = idx;
                        swipe = swipes[idx];
                        swipes = swipe.swipes;
                        text += swipe.mes;
                    });
                    mes.mes = text;
                    mes.continueSwipe = swipe;
                    mes.continueSwipeId = swipeIdx;
                    let messageText = substituteParams(text);
                    messageText = messageFormatting(
                        messageText,
                        mes.name,
                        false,
                        mes.is_user,
                        null,
                    );
                    document.querySelector('#chat .last_mes .mes_text').innerHTML = messageText;
                    saveChatConditional();
                    eventSource.emit(event_types.MESSAGE_EDITED, chat.length - 1);
                }
            });
            dom.append(undoTrigger);
        }
        const redoTrigger = document.createElement('span'); {
            redoTrigger.classList.add('mfc--redo');
            redoTrigger.classList.add('mfc--action');
            redoTrigger.textContent = '↷';
            // dom.append(redoTrigger);
        }
        const regen = document.createElement('span'); {
            regen.classList.add('mfc--regen');
            regen.classList.add('mfc--action');
            regen.textContent = '↻';
            regen.title = 'Regenerate last continue';
            regen.addEventListener('pointerenter', onHover);
            regen.addEventListener('pointerleave', onUnhover);
            regen.addEventListener('click', async()=>{
                if (busy()) return;
                log('[REGEN]');
                const mes = chat.slice(-1)[0];
                if (mes.continueSwipe?.parent?.length) {
                    let swipeIdx;
                    let swipe;
                    let swipes = mes.continueHistory;
                    let text = '';
                    mes.continueSwipe.parent.forEach(idx=>{
                        swipeIdx = idx;
                        swipe = swipes[idx];
                        swipes = swipe.swipes;
                        text += swipe.mes;
                    });
                    mes.mes = text;
                    mes.continueSwipe = swipe;
                    mes.continueSwipeId = swipeIdx;
                    let messageText = substituteParams(`${text} ...`);
                    messageText = messageFormatting(
                        messageText,
                        mes.name,
                        false,
                        mes.is_user,
                    );
                    document.querySelector('#chat .last_mes .mes_text').innerHTML = messageText;
                    await Generate('continue');
                    log('DONE');
                }
            });
            dom.append(regen);
            last_regen = regen;
        }
        const swipesTrigger = document.createElement('span'); {
            swipesTrigger.classList.add('mfc--swipes');
            swipesTrigger.classList.add('mfc--action');
            swipesTrigger.textContent = '▤';
            swipesTrigger.title = 'Show continues';
            swipesTrigger.addEventListener('click', async(evt)=>{
                if (busy()) return;
                log('[SWIPES]');

                // const mes = chat.slice(-1)[0];
                const mes = chat[Number(swipesTrigger.closest('[mesid]').getAttribute('mesid'))];
                if (mes.continueHistory[mes.swipe_id ?? 0]) {
                    const renderTree = (swipe, act, isRoot=false)=>{
                        const el = document.createElement('div'); {
                            el.classList.add('mfc--tree');
                            el.classList.add('list-group');
                            el.classList.add('mfc--ctx-item');
                            const txt = document.createElement('div'); {
                                txt.classList.add('mfc--treeText');
                                txt.textContent = swipe.mes.trim();
                                txt.addEventListener('click', ()=>{
                                    let mesmes = '';
                                    let ss = mes.continueHistory;
                                    for (const idx of swipe.parent) {
                                        const s = ss[idx];
                                        mesmes += s.mes;
                                        ss = s.swipes;
                                    }
                                    mesmes += swipe.mes;
                                    log('NEW MES', mesmes);
                                    mes.mes = mesmes;
                                    mes.continueSwipe = swipe;
                                    mes.continueSwipeId = ss.indexOf(swipe);
                                    mes.continueHistory[mes.swipe_id ?? 0].active = [...swipe.parent, ss.indexOf(swipe)];
                                    let messageText = substituteParams(mesmes);
                                    messageText = messageFormatting(
                                        messageText,
                                        mes.name,
                                        false,
                                        mes.is_user,
                                        null,
                                    );
                                    swipesTrigger.closest('[mesid]').querySelector('.mes_text').innerHTML = messageText;
                                    saveChatConditional();
                                    eventSource.emit(event_types.MESSAGE_EDITED, chat.length - 1);
                                });
                                el.append(txt);
                            }
                            if (swipe.swipes.length > 0) {
                                const ul = document.createElement('ul'); {
                                    ul.classList.add('mfc--children');
                                    let i = 0;
                                    for (const s of swipe.swipes) {
                                        const li = document.createElement('li'); {
                                            li.classList.add('list-group-item');
                                            if (i === act[0]) {
                                                li.classList.add('mfc--active');
                                            }
                                            li.append(renderTree(s, i === act[0] ? act.slice(1) : []));
                                            ul.append(li);
                                        }
                                        i++;
                                    }
                                    el.append(ul);
                                }
                            }
                        }
                        return el;
                    };
                    const blocker = document.createElement('div'); {
                        blocker.classList.add('mfc--ctx-blocker');
                        blocker.addEventListener('click', ()=>{
                            blocker.remove();
                        });
                        const content = renderTree(mes.continueHistory[mes.swipe_id ?? 0], mes.continueHistory[mes.swipe_id ?? 0].active.slice(1), true);
                        blocker.append(content);
                        const rect = swipesTrigger.getBoundingClientRect();
                        content.style.setProperty('--triggerTop', `${rect.bottom}px`);
                        content.style.setProperty('--triggerRight', `${rect.right}px`);
                        content.classList[rect.top > window.innerHeight / 2 ? 'add' : 'remove']('mfc--flipV');
                        // content.style.top = `${swipesTrigger.getBoundingClientRect().bottom}px`;
                        // content.style.left = `${swipesTrigger.getBoundingClientRect().right}px`;
                        document.body.append(blocker);
                        await new Promise(resolve=>requestAnimationFrame(resolve));

                    }
                }
            });
            dom.append(swipesTrigger);
        }
        const cont = document.createElement('span'); {
            cont.classList.add('mfc--cont');
            cont.classList.add('mfc--action');
            cont.textContent = '➜';
            cont.title = 'Continue';
            cont.addEventListener('click', async()=>{
                if (busy()) return;
                log('[CONTINUE]');
                await Generate('continue');
                log('DONE');
            });
            dom.append(cont);
        }
        const fav = document.createElement('span'); {
            fav.classList.add('mfc--fav');
            fav.classList.add('mfc--action');
            fav.textContent = '⭐';
            fav.title = 'Favorite this swipe';
            fav.addEventListener('click', ()=>{
                const mesId = Number(swipesTrigger.closest('[mesid]').getAttribute('mesid'));
                const mes = chat[mesId];
                if (!mes.swipe_info) {
                    mes.swipe_info = [];
                }
                if (!mes.swipe_info[mes.swipe_id]) {
                    mes.swipe_info[mes.swipe_id] = {};
                }
                const isFav = mes.swipe_info[mes.swipe_id].isFavorite;
                mes.swipe_info[mes.swipe_id].isFavorite = !isFav;
                updateFav(mesId);
                saveChatDebounced();
            });
            dom.append(fav);
        }
    }
    return dom;
};
const makeSwipeDom = ()=>{
    for (const mes of chat) {
        insertContinueData(mes);
    }
    const els = Array.from(document.querySelectorAll('#chat .mes'));
    for (const el of els) {
        const elTop = el.querySelector('.name_text').parentElement;
        const elBot = el;

        if (settings.buttonsTop && !el.querySelector('.mfc--root[data-mfc="top"]')) {
            elTop.append(buildSwipeDom('top', el));
        } else if (!settings.buttonsTop && el.querySelector('.mfc--root[data-mfc="top"]')) {
            el.querySelector('.mfc--root[data-mfc="top"]').remove();
        }

        if (settings.buttonsBottom && !el.querySelector('.mfc--root[data-mfc="bottom"]')) {
            elBot.append(buildSwipeDom('bottom', el));
        } else if (!settings.buttonsBottom && el.querySelector('.mfc--root[data-mfc="bottom"]')) {
            el.querySelector('.mfc--root[data-mfc="bottom"]').remove();
        }
        updateFav(el.getAttribute('mesid'));
    }
};

const updateFav = (mesId)=>{
    const mes = chat[mesId];
    const isFav = mes.swipe_info?.[mes.swipe_id]?.isFavorite ?? false;
    const favButtons = [...document.querySelectorAll(`#chat .mes[mesid="${mesId}"] .mfc--fav`)];
    favButtons.forEach(it=>it.classList[isFav ? 'add' : 'remove']('mfc--isFav'));
};

let patchid = 0;
const onMessageDone = async(mesIdx)=>{
    if(mesIdx)
        patchid=mesIdx;
    else
        mesIdx=patchid;
    addSwipesButton(mesIdx, true);
    makeSwipeDom();
    const mes = chat[mesIdx];
    insertContinueData(mes);
    if (!isListening) return;
    if (mes.mes == startMes) return;
    if (mes.mes == '...') return;
    isListening = false;
    log(mes.mes, mes);
    // eslint-disable-next-line no-unused-vars
    if (startMes == '') {
        mes.continueHistory[mes.swipe_id ?? 0].mes = mes.mes;
    } else {
        const [_, ...rest] = mes.mes.split(startMes);
        const newMes = rest.join(startMes);
        const swipe = {
            mes: newMes,
            swipes: [],
            parent: [...mes.continueSwipe.parent, mes.continueSwipeId],
        };
        let swipes = mes.continueHistory;
        swipe.parent.forEach(it=>swipes = swipes[it].swipes);
        swipes.push(swipe);
        mes.continueSwipe = swipe;
        mes.continueSwipeId = swipes.length - 1;
        mes.continueHistory[mes.swipe_id ?? 0].active = [...mes.continueSwipe.parent, mes.continueSwipeId];
        log(mes);
    }
    makeSwipeDom();
};

const onMessageEdited = async(mesIdx)=>{
    log('[MESSAGE_EDITED]', mesIdx);
    // check how much of the beginning of the message is still intact
    let swipes = chat[mesIdx].continueHistory;
    let swipe;
    let text = '';
    const active = [];
    for (const idx of chat[mesIdx].continueHistory[chat[mesIdx].swipe_id ?? 0].active) {
        swipe = swipes[idx];
        const newText = `${text}${swipes[idx].mes}`;
        if (!chat[mesIdx].mes.startsWith(newText) && !(swipe.parent.length == 0 && newText == '')) {
            const newSwipe = {
                mes: chat[mesIdx].mes.substring(text.length),
                parent: [...swipe.parent],
                swipes: [],
            };
            if (swipe.parent.length == 0) {
                const newIdx = 1;
                newSwipe.parent = [chat[mesIdx].swipe_id ?? 0];
                const unshiftParent = (childSwipes)=>{
                    for (const childSwipe of childSwipes) {
                        childSwipe.parent.unshift(chat[mesIdx].swipe_id ?? 0);
                        unshiftParent(childSwipe.swipes);
                    }
                };
                unshiftParent(swipes);
                swipes[idx] = {
                    mes: '',
                    parent: [],
                    swipes: [swipe, newSwipe],
                    active: [chat[mesIdx].swipe_id ?? 0, newIdx],
                };
                delete swipe.active;
                chat[mesIdx].continueSwipe = newSwipe;
                chat[mesIdx].continueSwipeId = newIdx;
                text = chat[mesIdx].mes;
            } else {
                const newIdx = swipes.length;
                swipes.push(newSwipe);
                active.push(newIdx);
                chat[mesIdx].continueHistory[chat[mesIdx].swipe_id ?? 0].active = active;
                chat[mesIdx].continueSwipe = newSwipe;
                chat[mesIdx].continueSwipeId = newIdx;
                text = chat[mesIdx].mes;
            }
            break;
        }
        active.push(idx);
        swipes = swipe.swipes;
        text = newText;
    }

    if (text.length < chat[mesIdx].mes.length) {
        const newSwipe = {
            mes: chat[mesIdx].mes.substring(text.length),
            parent: [...swipe.parent, active.slice(-1)[0]],
            swipes: [],
        };
        swipe.swipes.push(newSwipe);
        chat[mesIdx].continueSwipe = newSwipe;
        chat[mesIdx].continueSwipeId = swipe.swipes.length - 1;
        chat[mesIdx].continueHistory[chat[mesIdx].swipe_id ?? 0].active = [...newSwipe.parent, swipe.swipes.length - 1];
    }
};

const onSwipe = async(mesId)=>{
    log('swipe');
    let isGen = false;
    eventSource.once(event_types.GENERATION_STARTED, ()=>isGen = true);
    await delay (100);
    const mes = chat[mesId];
    if (isGen) {
        // a vanilla swipe simply copies the previous swipe's `extra` object
        // if the previous swipe was a favorite the new one will be marked as favorite, too...
        if (!mes.swipe_info) {
            mes.swipe_info = [];
        }
        if (!mes.swipe_info[mes.swipe_id]) {
            mes.swipe_info[mes.swipe_id] = {};
        }
        if (!mes.swipe_info[mes.swipe_id].extra) {
            mes.swipe_info[mes.swipe_id].extra = {};
        }
        mes.swipe_info[mes.swipe_id].isFavorite = false;
    }
    updateFav(mesId);
    if (mes.continueHistory) {
        let swipes = mes.continueHistory;
        let swipe;
        let swipeIdx;
        mes.continueHistory[mes.swipe_id ?? 0]?.active?.forEach(idx=>{
            swipeIdx = idx;
            swipe = swipes[idx];
            swipes = swipe.swipes;
        });
        mes.continueSwipeId = swipeIdx ?? mes.swipe_id ?? 0;
        mes.continueSwipe = swipe;
    }
};

const addSwipesButtons = ()=>{
    Array.from(document.querySelectorAll('#chat > .mes[mesid]')).forEach(it=>addSwipesButton(it.getAttribute('mesid')));
};
const addSwipesButton = (mesIdx, isForced = false)=>{
    const container = document.querySelector(`#chat > .mes[mesid="${mesIdx}"] .extraMesButtons`);
    if (!isForced && container.querySelector('.mfc--swipes')) return;
    Array.from(container.querySelectorAll('.mfc--swipes')).forEach(it=>it.remove());
    const mes = chat[mesIdx];
    const btn = document.createElement('div'); {
        btn.classList.add('mfc--swipes', 'fa-solid', 'fa-layer-group');
        btn.title = `View swipes (${mes.swipes?.length ?? 0})`;
        btn.addEventListener('click', async(evt)=>{
            const dom = document.createElement('div'); {
                dom.classList.add('mfc--swipesModal');
                const notice = document.createElement('div'); {
                    notice.textContent = 'Click to copy swipe';
                    dom.append(notice);
                }
                (mes.swipes ?? []).forEach((text, idx)=>{
                    const swipe = document.createElement('div'); {
                        swipe.classList.add('mfc--swipe');
                        swipe.classList.add('mes_text');
                        if (mes.swipe_info?.[idx]?.isFavorite) {
                            swipe.classList.add('mfc--isFav');
                        }
                        if (idx == mes.swipe_id) {
                            swipe.classList.add('mfc--current');
                        }
                        let messageText = substituteParams(text);
                        messageText = messageFormatting(
                            messageText,
                            mes.name,
                            false,
                            mes.is_user,
                            null,
                        );
                        swipe.innerHTML = messageText;
                        swipe.addEventListener('click', async()=>{
                            const ta = document.createElement('textarea'); {
                                ta.value = text;
                                ta.style.position = 'fixed';
                                ta.style.inset = '0';
                                document.body.append(ta);
                                ta.focus();
                                ta.select();
                                try {
                                    document.execCommand('copy');
                                } catch (err) {
                                    console.error('Unable to copy to clipboard', err);
                                }
                                ta.remove();
                            }
                            swipe.classList.add('mfc--flash');
                            await delay(1000);
                            swipe.classList.remove('mfc--flash');
                        });
                        dom.append(swipe);
                    }
                });
            }
            await callPopup(dom, 'text', null, { wide:true, large:true });
        });
        container.firstElementChild.insertAdjacentElement('beforebegin', btn);
    }
};

const onChatChanged = ()=>{
    // migrate swipe favorite from extra to swipe info
    {
        chat.forEach((mes,mesIdx)=>{
            if (mes.swipe_info?.length) {
                mes.swipe_info.forEach((swipe, swipeIdx)=>{
                    if (swipe.extra && Object.prototype.hasOwnProperty.call(swipe.extra, 'isFavorite')) {
                        log('[FAV->]', mesIdx, swipeIdx, swipe.extra.isFavorite);
                        swipe.isFavorite = true;
                        delete swipe.extra.isFavorite;
                    }
                });
            }
        });
    }
    makeSwipeDom();
    addSwipesButtons();
};




eventSource.on(event_types.APP_READY, ()=>{
    const addSettings = () => {
        const html = `
		<div class="mfc--settings">
			<div class="inline-drawer">
				<div class="inline-drawer-toggle inline-drawer-header">
					<b>More Flexible Continues</b>
					<div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
				</div>
				<div class="inline-drawer-content" style="font-size:small;">
                    <label class="flex-container">
                        <input type="checkbox" id="mfc--buttonsTop"> <span>Show buttons at the top of a message</span>
                    </label>
                    <label class="flex-container">
                        <input type="checkbox" id="mfc--buttonsBottom"> <span>Show buttons at the bottom of a message</span>
                    </label>
                    <label for="mfc--refreshHotkey" class="flex-container"><span>Refresh Hotkey</span></label>
                    <input type="text" id="mfc--refreshHotkey" class="text_pole textarea_compact"> <a href="https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values">Cheat Sheet</a>
				</div>
			</div>
		</div>
		`;
        $('#extensions_settings').append(html);

        /**@type {HTMLInputElement} */
        const top = document.querySelector('#mfc--buttonsTop');
        top.checked = settings.buttonsTop ?? true;
        top.addEventListener('click', ()=>{
            settings.buttonsTop = top.checked;
            saveSettingsDebounced();
            makeSwipeDom();
        });

        /**@type {HTMLInputElement} */
        const bot = document.querySelector('#mfc--buttonsBottom');
        bot.checked = settings.buttonsBottom ?? true;
        bot.addEventListener('click', ()=>{
            settings.buttonsBottom = bot.checked;
            saveSettingsDebounced();
            makeSwipeDom();
        });

        const hotkey_txt = document.querySelector('#mfc--refreshHotkey');
        hotkey_txt.value = settings.hotkey ?? '';
        hotkey_txt.addEventListener('change',()=>{
            settings.hotkey = hotkey_txt.value;
            saveSettingsDebounced();
        });
    };
    addSettings();
    onChatChanged();

    eventSource.on(event_types.GENERATION_STARTED, async(...args)=>{log('GENERATION_STARTED', args);onGenerationStarted(...args);return;});
    eventSource.on(event_types.GENERATION_STOPPED, async(...args)=>{log('GENERATION_STOPPED', args);onMessageDone(...args);return;});
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, async(...args)=>{log('CHARACTER_MESSAGE_RENDERED', args);onMessageDone(...args);return;});
    eventSource.on(event_types.USER_MESSAGE_RENDERED, async(...args)=>{log('USER_MESSAGE_RENDERED', args);onMessageDone(...args);return;});
    eventSource.on(event_types.MESSAGE_EDITED, async(...args)=>{log('MESSAGE_EDITED', args);onMessageEdited(...args);return;});
    eventSource.on(event_types.CHAT_CHANGED, async(...args)=>{log('CHAT_CHANGED', args);onChatChanged();return;});
    eventSource.on(event_types.MESSAGE_DELETED, async(...args)=>{log('MESSAGE_DELETED', args);return makeSwipeDom(...args);});
    eventSource.on(event_types.MESSAGE_SWIPED, async(...args)=>{log('MESSAGE_SWIPED', args);onSwipe(...args);return;});
});
