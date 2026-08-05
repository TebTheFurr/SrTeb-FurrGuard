import React, { lazy } from 'react';
import { Route, Switch, useRouteMatch } from 'react-router-dom';
import LoginContainer from '@/components/auth/LoginContainer';
import { NotFound } from '@/components/elements/ScreenBlock';
import { useHistory, useLocation } from 'react-router';
import Spinner from '@/components/elements/Spinner';

const RegisterContainer = lazy(() => import(/* webpackChunkName: "auth-register" */ '@/components/auth/RegisterContainer'));
const ForgotPasswordContainer = lazy(() => import(/* webpackChunkName: "auth-password" */ '@/components/auth/ForgotPasswordContainer'));
const ResetPasswordContainer = lazy(() => import(/* webpackChunkName: "auth-password" */ '@/components/auth/ResetPasswordContainer'));
const LoginCheckpointContainer = lazy(() => import(/* webpackChunkName: "auth-checkpoint" */ '@/components/auth/LoginCheckpointContainer'));

export default () => {
    const history = useHistory();
    const location = useLocation();
    const { path } = useRouteMatch();

    return (
        <div>
            <Spinner.Suspense>
                <Switch location={location}>
                    <Route path={`${path}/login`} component={LoginContainer} exact />
                    <Route path={`${path}/register`} component={RegisterContainer} exact />
                    <Route path={`${path}/login/checkpoint`} component={LoginCheckpointContainer} />
                    <Route path={`${path}/password`} component={ForgotPasswordContainer} exact />
                    <Route path={`${path}/password/reset/:token`} component={ResetPasswordContainer} />
                    <Route path={`${path}/checkpoint`} />
                    <Route path={'*'}>
                        <NotFound onBack={() => history.push('/auth/login')} />
                    </Route>
                </Switch>
            </Spinner.Suspense>
        </div>
    );
};
