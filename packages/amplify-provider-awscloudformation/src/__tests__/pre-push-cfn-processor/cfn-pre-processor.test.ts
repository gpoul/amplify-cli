import { CFNTemplateFormat, readCFNTemplate, writeCFNTemplate, pathManager, stateManager, CustomIAMPolicies } from 'amplify-cli-core';
import { Template } from 'cloudform-types';
import { prePushCfnTemplateModifier } from '../../pre-push-cfn-processor/pre-push-cfn-modifier';
import { preProcessCFNTemplate, writeCustomPoliciesToCFNTemplate } from '../../pre-push-cfn-processor/cfn-pre-processor';
import * as path from 'path';

jest.mock('amplify-cli-core');
jest.mock('../../pre-push-cfn-processor/pre-push-cfn-modifier');

const readCFNTemplate_mock = readCFNTemplate as jest.MockedFunction<typeof readCFNTemplate>;
const writeCFNTemplate_mock = writeCFNTemplate as jest.MockedFunction<typeof writeCFNTemplate>;
const prePushCfnTemplateModifier_mock = prePushCfnTemplateModifier as jest.MockedFunction<typeof prePushCfnTemplateModifier>;
const pathManager_mock = pathManager as jest.Mocked<typeof pathManager>;
const stateManager_mock = stateManager as jest.Mocked<typeof stateManager>;

const cfnTemplate = {
  test: 'content',
} as unknown as Template;
const templateFormat = CFNTemplateFormat.JSON;

const customPolicies: CustomIAMPolicies = [
  {
    Action: ['test:test'],
    Effect: 'Allow',
    Resource: ['arn:aws:s3:us-east-2:012345678910:testResource'],
  },
];

readCFNTemplate_mock.mockResolvedValue({
  templateFormat,
  cfnTemplate,
});

prePushCfnTemplateModifier_mock.mockImplementation(async (template: any) => {
  template.test = 'modified';
});

const backendPath = '/project/amplify/backend';
const resourcePath = 'api/resourceName/cfn-template-name.json';

pathManager_mock.getBackendDirPath.mockReturnValue(backendPath);
pathManager_mock.getResourceDirectoryPath.mockReturnValue(backendPath);
stateManager_mock.getCustomPolicies.mockReturnValue(customPolicies);
stateManager_mock.getLocalEnvInfo.mockReturnValue({ envName: 'test' });

describe('preProcessCFNTemplate', () => {
  beforeEach(jest.clearAllMocks);
  it('writes the modified template and returns the path', async () => {
    const newPath = await preProcessCFNTemplate(path.join(backendPath, resourcePath));
    expect(writeCFNTemplate_mock.mock.calls[0]).toMatchInlineSnapshot(`
      Array [
        Object {
          "test": "modified",
        },
        "/project/amplify/backend/awscloudformation/build/api/resourceName/cfn-template-name.json",
        Object {
          "templateFormat": "json",
        },
      ]
    `);
    expect(newPath).toMatchInlineSnapshot(`"/project/amplify/backend/awscloudformation/build/api/resourceName/cfn-template-name.json"`);
  });

  it('writes to root build directory if path is not within backend dir', async () => {
    const newPath = await preProcessCFNTemplate(path.join('/something/else', resourcePath));
    expect(newPath).toMatchInlineSnapshot(`"/project/amplify/backend/awscloudformation/build/cfn-template-name.json"`);
  });

  it('writes valid custom policies to cfn template', async () => {
    const cfnTemplate = {
      Resources: {
        LambdaExecutionRole: {
          Type: 'AWS::IAM::Role',
        },
      },
    } as unknown as Template;

    readCFNTemplate_mock.mockResolvedValueOnce({
      templateFormat,
      cfnTemplate,
    });

    await writeCustomPoliciesToCFNTemplate('test', 'Lambda', 'cfn-template.json', 'test');

    const templateWithCustomPolicies = writeCFNTemplate_mock.mock.calls[0][0] as any;

    expect(templateWithCustomPolicies.Resources.CustomLambdaExecutionPolicy.Properties.PolicyDocument.Statement).toEqual([
      {
        Action: ['test:test'],
        Effect: 'Allow',
        Resource: ['arn:aws:s3:us-east-2:012345678910:testResource'],
      },
    ]);
  });
});
