import React from 'react';
import { Redirect, useParams } from 'react-router-dom';

const ModsLegacyRedirect = () => {
    const { id } = useParams<{ id: string }>();

    return <Redirect to={`/server/${id}/minecraft-mods`} />;
};

export default ModsLegacyRedirect;
