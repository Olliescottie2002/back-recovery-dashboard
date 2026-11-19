export function openJournal(factory = indexedDB) {
  return new Promise((resolve,reject)=>{
    const request = factory.open('recovery-journal',1);
    request.onupgradeneeded = () => request.result.createObjectStore('records',{keyPath:'id'});
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(Error('Close other Recovery Journal tabs, then reload.'));
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve({
        all() {
          return new Promise((done,fail)=>{
            const read = db.transaction('records').objectStore('records').getAll();
            read.onsuccess = () => done(read.result);
            read.onerror = () => fail(read.error);
          });
        },
        write(records = [], remove = [], merge = false) {
          return new Promise((done,fail)=>{
            const tx = db.transaction('records','readwrite');
            const store = tx.objectStore('records');
            tx.oncomplete = () => done();
            tx.onabort = () => fail(tx.error || Error('The change could not be saved.'));
            remove.forEach(id=>store.delete(id));
            records.forEach(record=>{
              if (!merge) store.put(record);
              else {
                const check = store.get(record.id);
                check.onsuccess = () => { if (!check.result) store.add(record); };
              }
            });
          });
        }
      });
    };
  });
}
