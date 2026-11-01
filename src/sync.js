import { useCallback, useEffect, useRef, useState } from 'react';

// ───────────────────────────────────────────────
// 기기끼리 노트를 맞추는 규칙 (노트마다 "나중에 고친 쪽이 이김")
//  - 노트의 updatedAt이 더 큰 쪽이 최신
//  - 지운 노트는 "삭제 표시"(deleted: true)로 남겨서, 다른 기기에서 되살아나지 않게 함
//  - 클라우드와 확인한 마지막 버전은 meta.synced에 기록, 이 기기에서 지운 시각은 meta.tombs에 기록
// ───────────────────────────────────────────────

const META_KEY = 'sermon-sync-meta-v1';
const ver = (n) => n.updatedAt || 0;
const isBlank = (n) => !(n.passages && n.passages.length) && !n.title && !(n.body || '').trim();

export function loadMeta(uid) {
  try {
    const m = JSON.parse(localStorage.getItem(META_KEY));
    if (m && m.uid === uid && m.synced && m.tombs) return m;
  } catch {}
  return { uid, synced: {}, tombs: {} };
}
function saveMeta(m) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(m));
  } catch {}
}

// 클라우드 문서 목록(remote)을 이 기기의 노트(local)와 합침
// 돌려주는 값: { notes: 합친 노트, changed: 노트가 바뀌었는지, toPush: 클라우드에 올릴 것, meta }
export function reconcile(local, remote, metaIn) {
  const meta = { uid: metaIn.uid, synced: { ...metaIn.synced }, tombs: { ...metaIn.tombs } };
  const remoteMap = new Map(remote.map((d) => [d.id, d]));
  const handled = new Set();
  const out = [];
  const toPush = [];

  const take = (r) => {
    const { deleted, ...note } = r; // eslint-disable-line no-unused-vars
    meta.synced[r.id] = ver(r);
    delete meta.tombs[r.id];
    return note;
  };

  for (const l of local) {
    handled.add(l.id);
    const r = remoteMap.get(l.id);
    if (!r) {
      out.push(l);
      if (!isBlank(l)) toPush.push(l); // 클라우드에 아직 없는 노트
      continue;
    }
    if (r.deleted) {
      if (ver(l) > ver(r)) {
        out.push(l); // 지워진 뒤에 이 기기에서 다시 고쳤음 → 되살림
        toPush.push(l);
      } else {
        meta.tombs[l.id] = ver(r); // 다른 기기에서 지움 → 여기서도 지움
        meta.synced[l.id] = ver(r);
      }
      continue;
    }
    if (ver(r) > ver(l)) {
      out.push(take(r)); // 클라우드가 더 최신
    } else {
      out.push(l);
      if (ver(l) > ver(r)) toPush.push(l); // 이 기기가 더 최신
      else meta.synced[l.id] = ver(r); // 같음
    }
  }

  for (const r of remote) {
    if (handled.has(r.id)) continue;
    const t = meta.tombs[r.id];
    if (r.deleted) {
      meta.tombs[r.id] = ver(r);
      meta.synced[r.id] = ver(r);
      continue;
    }
    if (t !== undefined && t >= ver(r)) {
      // 이 기기에서 이미 지운 노트 → 클라우드에도 삭제 표시를 올림
      meta.synced[r.id] = ver(r);
      toPush.push({ id: r.id, deleted: true, updatedAt: t });
      continue;
    }
    out.push(take(r)); // 다른 기기에서 새로 만든 노트(또는 지운 뒤에 다른 기기에서 고친 노트)
  }

  const changed = out.length !== local.length || out.some((n, i) => n !== local[i]);
  return { notes: out, changed, toPush, meta };
}

// 클라우드와 계속 맞춰 주는 훅
//  backend: { subscribe(onDocs, onError) → 해제 함수, push(doc) → Promise }
export function useCloudSync({ notes, setNotes, backend, uid }) {
  const [status, setStatus] = useState(backend ? 'connecting' : 'off'); // off | connecting | syncing | synced | offline | error
  const [detail, setDetail] = useState('');
  const [lastSyncAt, setLastSyncAt] = useState(null);

  const notesRef = useRef(notes);
  notesRef.current = notes;
  const backendRef = useRef(backend);
  backendRef.current = backend;
  const metaRef = useRef(null);
  const readyRef = useRef(false); // 클라우드의 현재 내용을 한 번 받은 뒤부터 올림 (오래된 내용으로 덮어쓰지 않기 위해)
  const prevIdsRef = useRef(new Set(notes.map((n) => n.id)));
  const timerRef = useRef(null);
  const retryRef = useRef(null);
  const flushRef = useRef(() => {});

  const fail = useCallback((e) => {
    setStatus(typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'error');
    setDetail((e && (e.code || e.message)) || '');
  }, []);

  const pushDocs = useCallback(
    async (docs) => {
      const b = backendRef.current;
      const meta = metaRef.current;
      if (!b || !meta || !docs.length) return;
      setStatus('syncing');
      let failed = null;
      await Promise.all(
        docs.map(async (d) => {
          try {
            await b.push(d);
            meta.synced[d.id] = ver(d);
          } catch (e) {
            // 서버 규칙이 "더 오래된 내용으로 덮어쓰기"를 막은 경우: 곧 최신 내용을 받아 맞춰지므로 무시
            if (!(e && e.code === 'permission-denied' && readyRef.current)) failed = failed || e;
          }
        })
      );
      saveMeta(meta);
      if (failed) {
        fail(failed);
        clearTimeout(retryRef.current);
        retryRef.current = setTimeout(() => flushRef.current(), 8000); // 잠시 뒤 다시 시도
      } else {
        setStatus('synced');
        setDetail('');
        setLastSyncAt(Date.now());
      }
    },
    [fail]
  );

  // 이 기기에서 바뀐 것 중 아직 클라우드에 없는 것을 올림
  const flush = useCallback(() => {
    const meta = metaRef.current;
    if (!backendRef.current || !meta || !readyRef.current) return;
    const docs = [];
    for (const n of notesRef.current) {
      if (isBlank(n)) continue; // 아직 아무것도 안 쓴 새 노트는 올리지 않음
      const s = meta.synced[n.id];
      if (s === undefined || ver(n) > s) docs.push(n);
    }
    for (const [id, t] of Object.entries(meta.tombs)) {
      const s = meta.synced[id];
      if (s !== undefined && t > s) docs.push({ id, deleted: true, updatedAt: t });
    }
    if (docs.length) pushDocs(docs);
  }, [pushDocs]);
  flushRef.current = flush;

  // 연결: 클라우드의 변화를 계속 받아서 합침
  useEffect(() => {
    readyRef.current = false;
    if (!backend) {
      setStatus('off');
      return undefined;
    }
    setStatus('connecting');
    metaRef.current = loadMeta(uid);
    const unsub = backend.subscribe(
      (docs) => {
        const res = reconcile(notesRef.current, docs, metaRef.current);
        metaRef.current = res.meta;
        saveMeta(res.meta);
        readyRef.current = true;
        if (res.changed) {
          prevIdsRef.current = new Set(res.notes.map((n) => n.id));
          notesRef.current = res.notes;
          setNotes(res.notes);
        }
        if (res.toPush.length) pushDocs(res.toPush);
        else {
          setStatus('synced');
          setDetail('');
          setLastSyncAt(Date.now());
        }
      },
      (e) => fail(e)
    );
    return () => {
      if (unsub) unsub();
      clearTimeout(timerRef.current);
      clearTimeout(retryRef.current);
    };
  }, [backend, uid, setNotes, pushDocs, fail]);

  // 노트가 바뀌면: 지워진 노트에 삭제 표시를 남기고, 잠시 뒤 올림
  useEffect(() => {
    const meta = metaRef.current;
    const ids = new Set(notes.map((n) => n.id));
    if (meta) {
      for (const id of prevIdsRef.current) {
        if (!ids.has(id) && meta.tombs[id] === undefined) meta.tombs[id] = Date.now();
      }
      saveMeta(meta);
    }
    prevIdsRef.current = ids;
    if (!meta || !readyRef.current) return undefined;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => flushRef.current(), 1000);
    return () => clearTimeout(timerRef.current);
  }, [notes]);

  // 인터넷이 다시 연결되거나 앱이 앞/뒤로 바뀔 때도 바로 올림
  useEffect(() => {
    const go = () => flushRef.current();
    window.addEventListener('online', go);
    document.addEventListener('visibilitychange', go);
    return () => {
      window.removeEventListener('online', go);
      document.removeEventListener('visibilitychange', go);
    };
  }, []);

  const syncNow = useCallback(() => flushRef.current(), []);
  return { status, detail, lastSyncAt, syncNow };
}
