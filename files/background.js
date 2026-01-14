chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'loadWorkspaces') {
    loadWorkspaces(message.config).then(sendResponse).catch(err => sendResponse({error: err.message}));
    return true;
  }

  if (message.type === 'loadFolders') {
    loadFolders(message.config, message.workspace).then(sendResponse).catch(err => sendResponse({error: err.message}));
    return true;
  }

  if (message.type === 'createNote') {
    createNote(message.config, message.noteData).then(sendResponse).catch(err => sendResponse({error: err.message}));
    return true;
  }
});

async function loadWorkspaces(config) {
  const url = `${config.appUrl}/api/v1/workspaces`;
  const response = await fetch(url, {
    headers: {
      'Authorization': 'Basic ' + btoa(`${config.username}:${config.password}`)
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Erreur ${response.status} : ${text || response.statusText}`);
  }
  return await response.json();
}

async function loadFolders(config, workspace) {
  const url = `${config.appUrl}/api/v1/folders?workspace=${encodeURIComponent(workspace)}&tree=true`;
  const response = await fetch(url, {
    headers: {
      'Authorization': 'Basic ' + btoa(`${config.username}:${config.password}`)
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Erreur ${response.status} : ${text || response.statusText}`);
  }
  return await response.json();
}

async function createNote(config, noteData) {
  const url = `${config.appUrl}/api/v1/notes`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Authorization': 'Basic ' + btoa(`${config.username}:${config.password}`)
    },
    body: JSON.stringify({
      heading: noteData.heading,
      content: noteData.content,
      tags: noteData.tags,
      folder_id: noteData.folder_id,
      workspace: noteData.workspace
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Erreur ${response.status} : ${text || response.statusText}`);
  }

  return { success: true };
}
