import http from '@/api/http';

/**
 * Returns the total size in bytes of a directory and everything below it.
 *
 * The directory listing cannot provide this: the size it reports for a folder
 * is the size of the directory inode, not of its contents. Wings has to walk
 * the tree, so this is a separate call made only when a folder is displayed.
 */
export default async (uuid: string, directory: string): Promise<number> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/files/directory-size`, {
        params: { directory },
    });

    return Number(data.attributes.size) || 0;
};
