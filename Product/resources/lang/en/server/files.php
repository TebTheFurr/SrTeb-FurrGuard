<?php

return [
    'title' => 'File Manager',
    'search' => 'Search files...',
    'name' => 'Name',
    'size' => 'Size',
    'modified' => 'Modified',
    'list_view' => 'List View',
    'ide_view' => 'IDE View',
    'list' => 'List',
    'ide' => 'IDE',
    'trash' => 'Trash',

    'empty' => [
        'title' => 'Empty Directory',
        'message' => 'This directory is empty. Upload some files to get started.',
        'no_results_title' => 'No Results',
        'no_results_message' => 'No files match your search criteria.',
    ],

    'directory_large' => 'This directory is too large to display in the browser, limiting the output to the first 250 files.',

    'actions' => [
        'refresh' => 'Refresh',
        'upload' => 'Upload',
        'new_file' => 'New File',
        'download' => 'Download',
        'delete' => 'Delete',
        'delete_permanently' => 'Delete Permanently',
        'delete_forever' => 'Delete Forever',
    ],

    'new_directory' => [
        'title' => 'Create Folder',
        'label' => 'Name',
        'help' => 'This directory will be created as',
        'button' => 'Create',
        'cancel' => 'Cancel',
        'validation_required' => 'A valid directory name must be provided.',
    ],

    'trash_modal' => [
        'empty_title' => 'Empty Trash',
        'empty_confirm' => 'Empty Trash',
        'delete_confirm' => 'Delete Forever',
    ],

    'mass_actions' => [
        'delete_title' => 'Delete :count File|Delete :count Files',
    ],

    'folder_uploads_not_supported' => 'Folder uploads are not supported.',
];
