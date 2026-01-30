document.addEventListener('DOMContentLoaded', () => {
  const status = document.getElementById('status');
  const configSection = document.getElementById('configSection');
  const toggleConfigBtn = document.getElementById('toggleConfig');
  const workspaceSection = document.getElementById('workspaceSection');
  const toggleWorkspaceBtn = document.getElementById('toggleWorkspace');
  const currentWorkspaceDisplay = document.getElementById('currentWorkspace');
  const loadFoldersBtn = document.getElementById('loadFolders');

  let config = {};
  let selectedWorkspace = '';
  let currentFolderMap = {};
  let foldersLoadedForCurrentWorkspace = false;

  // Chargement persistant
  chrome.storage.sync.get(['poznoteConfig', 'lastWorkspace'], (result) => {
    if (result.poznoteConfig) {
      config = result.poznoteConfig;
      document.getElementById('appUrl').value = config.appUrl || '';
      document.getElementById('username').value = config.username || '';
      document.getElementById('password').value = config.password || '';
      collapseConfigSection();
    }

    if (result.lastWorkspace) {
      selectedWorkspace = result.lastWorkspace;
      showCurrentWorkspace(selectedWorkspace);
      collapseWorkspaceSection();
    }
  });

  // Restauration des dossiers
  chrome.storage.session.get(['folderMap', 'lastLoadedWorkspace'], (result) => {
    if (result.lastLoadedWorkspace === selectedWorkspace && result.folderMap) {
      currentFolderMap = result.folderMap;
      populateFolderSelect(currentFolderMap);
      foldersLoadedForCurrentWorkspace = true;
      loadFoldersBtn.style.display = 'none';
      updateStatus(`Dossiers prêts pour "${selectedWorkspace}"`, 'green');
    }
  });

  function collapseConfigSection() {
    configSection.classList.remove('expanded');
    configSection.classList.add('collapsed');
    toggleConfigBtn.style.display = 'block';
  }

  function expandConfigSection() {
    configSection.classList.remove('collapsed');
    configSection.classList.add('expanded');
    toggleConfigBtn.style.display = 'none';
  }

  function collapseWorkspaceSection() {
    workspaceSection.classList.remove('expanded');
    workspaceSection.classList.add('collapsed');
    toggleWorkspaceBtn.style.display = 'block';
  }

  function expandWorkspaceSection() {
    workspaceSection.classList.remove('collapsed');
    workspaceSection.classList.add('expanded');
    toggleWorkspaceBtn.style.display = 'none';
  }

  function showCurrentWorkspace(name) {
    currentWorkspaceDisplay.textContent = `Workspace actuel : ${name}`;
    currentWorkspaceDisplay.style.display = 'block';
  }

  toggleConfigBtn.addEventListener('click', expandConfigSection);

  toggleWorkspaceBtn.addEventListener('click', () => {
    expandWorkspaceSection();
    loadFoldersBtn.style.display = 'block';
    foldersLoadedForCurrentWorkspace = false;
  });

  // Sauvegarde config
  document.getElementById('saveConfig').addEventListener('click', () => {
    config = {
      appUrl: document.getElementById('appUrl').value.trim().replace(/\/+$/, ''),
      username: document.getElementById('username').value.trim(),
      password: document.getElementById('password').value.trim()
    };

    if (!config.appUrl || !config.username || !config.password) {
      updateStatus('⚠️ Tous les champs sont obligatoires !', 'red');
      return;
    }

    chrome.storage.sync.set({ poznoteConfig: config }, () => {
      updateStatus('✅ Configuration sauvegardée !', 'green');
      collapseConfigSection();
    });
  });

  // Charger workspaces
  document.getElementById('loadWorkspaces').addEventListener('click', async () => {
    if (!config.appUrl) {
      updateStatus('⚠️ Configure d\'abord Poznote', 'red');
      return;
    }

    updateStatus('⏳ Chargement des workspaces...', 'orange');

    try {
      const response = await chrome.runtime.sendMessage({ type: 'loadWorkspaces', config });
      if (response.error) throw new Error(response.error);

      let workspacesArray = Array.isArray(response) ? response :
                          (response.data || response.workspaces || []);

      workspacesArray.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      const select = document.getElementById('workspaceSelect');
      select.innerHTML = '<option value="">-- Choisir un workspace --</option>';

      workspacesArray.forEach(ws => {
        select.add(new Option(ws.name, ws.name));
      });

      updateStatus(`✅ ${workspacesArray.length} workspace(s) disponible(s)`, 'green');
    } catch (err) {
      updateStatus('❌ ' + err.message, 'red');
    }
  });

  // Sélection workspace
  document.getElementById('workspaceSelect').addEventListener('change', (e) => {
    selectedWorkspace = e.target.value;
    if (selectedWorkspace) {
      chrome.storage.sync.set({ lastWorkspace: selectedWorkspace });
      showCurrentWorkspace(selectedWorkspace);
      collapseWorkspaceSection();
      updateStatus(`Workspace : ${selectedWorkspace}`, 'blue');

      document.getElementById('folderSelect').innerHTML = '<option value="">-- Racine (aucun dossier) --</option>';
      currentFolderMap = {};
      chrome.storage.session.remove(['folderMap', 'lastLoadedWorkspace']);
      foldersLoadedForCurrentWorkspace = false;
      loadFoldersBtn.style.display = 'block';
    }
  });

  // Charger les dossiers
  document.getElementById('loadFolders').addEventListener('click', async () => {
    if (!selectedWorkspace) {
      updateStatus('⚠️ Choisis d\'abord un workspace', 'orange');
      return;
    }

    updateStatus('⏳ Chargement des dossiers...', 'orange');

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'loadFolders',
        config,
        workspace: selectedWorkspace
      });
      if (response.error) throw new Error(response.error);

      const folders = response.folders || [];

      const folderSelect = document.getElementById('folderSelect');
      folderSelect.innerHTML = '<option value="">-- Racine (aucun dossier) --</option>';

      const folderMap = new Map();
      let count = 0;

      folders.sort((a, b) => (a.path || '').localeCompare(b.path || ''));

      folders.forEach(folder => {
        const folderId = folder.id;
        const path = folder.path || folder.name || 'Dossier sans nom';

        const displayText = `📁 ${path}`;

        if (folderId) {
          folderMap.set(path, folderId);
        }

        folderSelect.add(new Option(displayText, path));
        count++;
      });

      currentFolderMap = Object.fromEntries(folderMap);
      chrome.storage.session.set({
        folderMap: currentFolderMap,
        lastLoadedWorkspace: selectedWorkspace
      });

      foldersLoadedForCurrentWorkspace = true;
      loadFoldersBtn.style.display = 'none';

      updateStatus(`✅ ${count} dossier(s) chargé(s)`, 'green');
    } catch (err) {
      updateStatus('❌ ' + err.message, 'red');
    }
  });

  function populateFolderSelect(map) {
    const folderSelect = document.getElementById('folderSelect');
    folderSelect.innerHTML = '<option value="">-- Racine (aucun dossier) --</option>';

    Object.keys(map)
      .sort((a, b) => a.localeCompare(b))
      .forEach(path => {
        folderSelect.add(new Option(`📁 ${path}`, path));
      });
  }

  // Créer la note avec capture d'écran (base64)
  document.getElementById('saveNote').addEventListener('click', async () => {
    if (!selectedWorkspace) {
      updateStatus('⚠️ Aucun workspace sélectionné', 'red');
      return;
    }

    const selectedPath = document.getElementById('folderSelect').value;
    const folderId = currentFolderMap[selectedPath] || null;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    let pageTitle = tab.title || 'Page sans titre';
    let pageUrl = tab.url;

    updateStatus('Capture d\'écran en cours...', 'blue');

    let screenshotDataUrl = null;
    try {
      screenshotDataUrl = await chrome.tabs.captureVisibleTab(null, {
        format: 'png'
      });
    } catch (err) {
      console.error('Erreur capture :', err);
      updateStatus('⚠️ Impossible de capturer l\'écran (page chrome:// ou extension ?)', 'orange');
    }

    // Contenu enrichi
    let noteContent = `
      <p><strong>🔗 URL :</strong> <a href="${pageUrl}" target="_blank">${pageUrl}</a></p>
      <p><strong>Titre :</strong> ${pageTitle}</p>
    `;

    if (screenshotDataUrl) {
      noteContent += `
        <p><strong>Capture d'écran de la page :</strong></p>
        <img src="${screenshotDataUrl}" alt="Capture d'écran de ${pageTitle}" style="max-width:100%; height:auto; border:1px solid #ddd; border-radius:4px;">
      `;
    } else {
      noteContent += `<p><em>Pas de capture d'écran disponible</em></p>`;
    }

    const noteData = {
      heading: `🔗 ${pageTitle}`,
      content: noteContent,
      tags: '',
      folder_id: folderId,
      workspace: selectedWorkspace
    };

    updateStatus('Création de la note avec capture...', 'orange');

    try {
      const response = await chrome.runtime.sendMessage({ type: 'createNote', config, noteData });
      if (response.error) throw new Error(response.error);
      updateStatus('💾 Note + capture créée avec succès !', 'green');
    } catch (err) {
      updateStatus('❌ ' + err.message, 'red');
    }
  });

  function updateStatus(text, color) {
    status.textContent = text;
    status.style.color = color;
  }
});